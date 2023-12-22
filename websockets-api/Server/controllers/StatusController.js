'use strict';

var utils = require('../utils/writer.js');
var Status = require('../service/StatusService.js');
var constants = require('../utils/constants.js');
const Reviews = require("../service/ReviewsService");
const webSocketPort = 3002;

const WebSocket = require('ws');
const wss = new WebSocket.Server({port: webSocketPort});
wss.on('connection', (ws, req) => {
    const client = req.connection.remoteAddress;
    const userAgent = req.headers["user-agent"];
    console.log("WebSocket client connected: " + client + "@" + userAgent);

    ws.on('close', () => {
        console.log('WebSocket client disconnected: ' + client + "@" + userAgent);
    });
});

module.exports.updateLoginStatus = function (user) {
    Status.updateLoginStatus(user)
        .then(() => {
            let u = { typeMessage: "login", userId: user.id, userName: user.name};
            console.log("New login detected. WebSocket server sending: " + JSON.stringify(u));
            wss.clients.forEach((client) => {
                if (client.readyState === WebSocket.OPEN) {
                    client.send(JSON.stringify(u));
                }
            });
        })
        .catch((err) => console.log(err));
}

module.exports.updateLogoutStatus = function (user) {
    Status.updateLogoutStatus(user)
        .then(() => {
            let u = { typeMessage: "logout", userId: user.id, userName: user.name};
            console.log("New logout detected. WebSocket server sending: " + JSON.stringify(u));
            wss.clients.forEach((client) => {
                if (client.readyState === WebSocket.OPEN) {
                    client.send(JSON.stringify(u));
                }
            });
        })
        .catch((err) => console.log(err));
}

module.exports.activeFilm = function (req, res, next) {
    Status.updateActiveFilm(req.user.id, req.params.filmId)
        .then( (response) => {
            let u = { typeMessage: "update", userId: response.userId, userName: response.userName, filmId: response.filmId, filmTitle: response.filmTitle };
            console.log("New update detected. WebSocket server sending: " + JSON.stringify(u));
            wss.clients.forEach((client) => {
                if (client.readyState === WebSocket.OPEN) {
                    client.send(JSON.stringify(u));
                }
            });
        })
    next();
}