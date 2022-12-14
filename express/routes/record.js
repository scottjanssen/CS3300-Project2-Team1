const express = require("express");
const fetch = require("node-fetch");
const axios = require("axios");
const tf = require("@tensorflow/tfjs")

const localClient = axios.create({ baseURL: 'http://localhost:5001/' })
 
// mapRoutes is an instance of the express router.
// We use it to define our routes.
// The router will be added as a middleware and will take control of requests starting with path /record.
const mapRoutes = express();
mapRoutes.use(express.json());

const dbo = require("../db/conn");
const db_connect = dbo.getDb();

const BASE = 'USD'
const BEGINNING = '1998-12-31'
const API_KEY = '56tPaXQVQ1qyaazJpd5ILx5KAFAbIAv2'//Scott's 'JJXPliIH6gNEAjqcBYUvkUYl9bqyEAcH'

const getDateStr = (date) => {
    return `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}-${date.getDate().toString().padStart(2, '0')}`
}

const getDate = (dateStr, offset=0) => {
    [y, m, d] = dateStr.split('-')
    let date = new Date();
    date.setFullYear(+y)
    date.setMonth(+m - 1)
    date.setDate(+d + offset);
    return getDateStr(date)
}

const getToday = (minusT=0) => {
    const date = new Date();
    date.setDate(date.getDate() - minusT)
    return getDateStr(date)
}

// updates the entire database to recent rates
mapRoutes.get('/api/update/', (req, res) => {
    const dbConnect = dbo.getDb();
    let today = getToday()

    dbConnect.collection('historical')
        .find()
        .sort({ date: -1 })
        .limit(1)
        .toArray()
        .then(async (data) => {
            if (data.length == 0) data = [{date: BEGINNING}]
            // console.log(data[0].date, today)
            if (data[0].date < today) {
                let latest = data[0].date
                let [year, ...rest] = latest.split('-')

                // console.log('not updated')
                // console.log(latest, today)


                let i = 1
                while (latest < today) {
                    let next_latest = (+year + i).toString() + '-' + rest.join('-')
                    if (today < next_latest) next_latest = today

                    // console.log('hi', latest, next_latest)
                    // console.log(getDate(latest, 1), next_latest, BASE, API_KEY)
                    await axios.get(`https://api.apilayer.com/exchangerates_data/timeseries?start_date=${getDate(latest, 1)}&end_date=${next_latest}&base=${BASE}&apikey=${API_KEY}`,
                        {headers: {redirect: 'follow', apikey: API_KEY}})
                        .then((result) => {
                            // console.log('...fetched')
                            let new_data = result.data.rates
                            // console.log('brooo', new_data)
                            Object.keys(new_data).forEach((date) => {
                                // console.log(date)
                                dbConnect.collection('historical').insertOne({
                                    date: date,
                                    sortDate: new Date(date),
                                    ...new_data[date]
                                })
                            })
                            // console.log('...uploaded')
                        })
                        .catch((err) => {
                            // console.log('hiiiiii')
                            console.log(err)
                        })
                    // console.log(i)
                    latest = next_latest
                    i++
                }
                res.json(true)
            } else {
                res.json(false)
            }
        })
        .catch((err) => {
            console.log(err)
            res.json(false)
        })
})

// get one conversion value
mapRoutes.get('/api/get/:base/:target/:amount/', function (req, res) {
    const dbConnect = dbo.getDb();
    let today = getToday()

    // console.log('yooooo', req.params)

    dbConnect.collection('historical').findOne({ 'date': today })
        .then((data) => {
            if (data) {
                baseRate = +data[req.params.base]
                targetRate = +data[req.params.target]
                res.json(targetRate / baseRate * (+req.params.amount))
            } else {
                localClient.get('http://localhost:5001/api/update/')
                    .then(() => {
                        // console.log(response.data)
                        dbConnect.collection('historical').findOne({ 'date': today })
                            .then((data) => {
                                baseRate = +data[req.params.base]
                                targetRate = +data[req.params.target]
                                res.json(targetRate / baseRate * (+req.params.amount))
                            })
                    })
                    .catch((err) => {
                        console.log(err)
                        res.json(false)
                    })
            }
        })
})

// get complete historical data that exists
mapRoutes.get('/api/historical/:base/:target/', (req, res) => {
    const dbConnect = dbo.getDb();

    localClient.get(`http://localhost:5001/api/update/`)
        .then(() => {
            // console.log('yo', req.params)

            let query = {}
            query[req.params.base] = {
                $exists: true
            }
            query[req.params.target] = {
                $exists: true
            }

            let proj = { _id: 0, date: 1 }
            proj[req.params.base] = 1
            proj[req.params.target] = 1


            // console.log(proj)
            dbConnect.collection('historical').find(query)
                .project(proj)
                .sort({ date: 1 })
                .toArray()
                .then((data) => {
                    result = data.map((d) => {
                        // console.log()
                        return {
                            date: d.date,
                            rate: (+d[req.params.target]) / (+d[req.params.base])
                        }
                    })
                    // console.log(result)
                    res.json(result)
                })
        })
        .catch((err) => {
            console.log(err)
            res.json(false)
        })
})

mapRoutes.get('/api/quarter/:base/:target/', (req, res) => {
    const dbConnect = dbo.getDb();
    let pastQuarter = getToday(90)
    // console.log(pastQuarter)

    localClient.get(`http://localhost:5001/api/update/`)
        .then(() => {
            let query = { date: { $gt: pastQuarter } }
            query[req.params.base] = {
                $exists: true
            }
            query[req.params.target] = {
                $exists: true
            }
        
            let proj = { _id: 0, date: 1 }
            proj[req.params.base] = 1
            proj[req.params.target] = 1
        
        
            // console.log(proj)
            dbConnect.collection('historical').find(query)
                .project(proj)
                .sort({ date: 1 })
                .toArray()
                .then((data) => {
                    res.json(data.map((d) => {
                        return {
                            date: d.date,
                            rate: (+d[req.params.target]) / (+d[req.params.base])
                        }
                    }))
                })
        })
        .catch((err) => {
            console.log(err)
            res.json(false)
        })
})

mapRoutes.route('/api/scaling/:base/:target').get((req, res) => {
    let base = req.params.base,
        target = req.params.target;

    localClient.get(`http://localhost:5001/api/historical/${base}/${target}`)
        .then((histData) => {
            let rates = histData.data.map(d => +d.rate)
            res.json({
                max: Math.max(...rates),
                min: Math.min(...rates)
            })
        })
})

mapRoutes.route("/api/predict/:base/:target").get((req, res) => {
    let base = req.params.base,
        target = req.params.target;

    localClient.get(`http://localhost:5001/api/scaling/${base}/${target}/`)
        .then((scaling) => {
            let min = scaling.data.min,
                max = scaling.data.max
            // console.log('scaling', min, max)
            localClient.get(`http://localhost:5001/api/quarter/${base}/${target}/`)
            .then((histData) => {
                // console.log(histData.data)

                let x = histData.data.map( d => +d.rate )
                x = x.map((r) => {
                    return (r - min) / (max - min) * 0.9 + 0.05
                })
                // console.log(x, x.length)

                x = tf.tensor(x).reshape([1, 90, 1])
                // console.log(x.shape)

                tf.loadLayersModel('http://localhost:5001/api/ml/classify')
                    .then((model) => {
                        // console.log('loaded')
                        let y = model.predict(x)
                        y = y.dataSync()

                        y = Array.from(y).map((r, i) => {
                            return {
                                date: getToday(-i - 1),
                                rate: (r - 0.05) / 0.9 * (max - min) + min
                            }
                        })

                        // console.log(y)

                        // TODO: scale y up
                        res.json(y)
                    })
            })
            .catch((err) => {
                console.log(err)
                res.json([])
            })
        })
        .catch((err) => {
            console.log(err)
            res.json([])
        })
})


 
module.exports = mapRoutes;