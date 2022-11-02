const express = require("express");
const fetch = require("node-fetch");
 
// mapRoutes is an instance of the express router.
// We use it to define our routes.
// The router will be added as a middleware and will take control of requests starting with path /record.
const mapRoutes = express.Router();

mapRoutes.route("/convert/:to/:from/:amount").get(function (req, res) {

    let myHeaders = new fetch.Headers();
    myHeaders.append("apikey", "IFt6YaCBh3agEYsLvFWDtZ6Sr2kWFKUG");

    const requestOptions = {
        method: 'GET',
        headers: myHeaders
    };

    let key = "IFt6YaCBh3agEYsLvFWDtZ6Sr2kWFKUG";

    fetch(`https://api.apilayer.com/exchangerates_data/convert?to=${req.params.to}&from=${req.params.from}&amount=${req.params.amount}&apikey=${key}`, requestOptions).then(response => response.json()).then(result => res.json(result));
});

mapRoutes.route("/timeseries/:begin/:end/:base").get(function (req, res) {

    let myHeaders = new fetch.Headers();
    myHeaders.append("apikey", "IFt6YaCBh3agEYsLvFWDtZ6Sr2kWFKUG");

    const requestOptions = {
        method: 'GET',
        headers: myHeaders
    };

    let key = "IFt6YaCBh3agEYsLvFWDtZ6Sr2kWFKUG";

    fetch(`https://api.apilayer.com/exchangerates_data/timeseries?start_date=${req.params.begin}&end_date=${req.params.end}&base=${req.params.base}&apikey=${key}`, requestOptions).then(response => response.json()).then(result => res.json(result));
});


 
module.exports = mapRoutes;