'use strict';

const User = require('../components/user');
const db = require('../components/db');
const bcrypt = require('bcrypt');

exports.getStatus = function () {
    return new Promise((resolve, reject) => {
        const sql = "SELECT * FROM status;";
        db.all(sql, [], (err, rows) => {
            if (err) reject(err);
            else resolve(rows);
        });
    });
}

exports.updateLoginStatus = function (user) {
    return new Promise((resolve, reject) => {
        const sql = "SELECT * FROM status WHERE userId=?;";
        db.all(sql, [user.id], (err, rows) => {
            if (err) reject(err);
            else if (rows.length > 0) {
                const sql1 = "UPDATE status SET userName=?, filmId=null, filmTitle=null WHERE userId=?;";
                db.run(sql1, [user.name, user.id], (err) => {
                    if (err) reject(err);
                    else resolve();
                });
            } else {
                const sql2 = "INSERT INTO status(userId, username) VALUES (?, ?);";
                db.run(sql2, [user.id, user.name], (err) => {
                    if (err) reject(err);
                    else resolve();
                });
            }
        })
    });
};

exports.updateLogoutStatus = function (user) {
    return new Promise((resolve, reject) => {
        const sql = "DELETE FROM status WHERE userId=?";
        db.run(sql, [user.id], (err) => {
            if (err) reject(err);
            else resolve();
        });
    });
};

exports.updateActiveFilm = function (userId, filmId) {
    return new Promise((resolve, reject) => {
        const sql3 = "SELECT * FROM films WHERE id=?;";
        db.get(sql3, [filmId], (err, filmRow) => {
            if (err) reject(err);
            else {
                const sql4 = "SELECT * FROM users WHERE id=?;";
                db.get(sql4, [userId], (err, userRow) => {
                    if (err) reject(err)
                    else {
                        const sql5 = "SELECT * FROM status WHERE userId=?;";
                        db.get(sql5, [userRow.id], (err, row) => {
                            if (err) reject(err)
                            else {
                                if(filmRow !== undefined) {
                                    if (row !== undefined) {
                                        const sql1 = "UPDATE status SET userName=?, filmId=?, filmTitle=? WHERE userId=?;";
                                        db.run(sql1, [userRow.name, filmRow.id, filmRow.title, userRow.id], (err) => {
                                            if (err) reject(err);
                                        });
                                    } else {
                                        const sql2 = "INSERT INTO status(userId, username, filmId, filmTitle) VALUES (?, ?, ?, ?);";
                                        db.run(sql2, [userRow.id, userRow.name, filmRow.id, filmRow.title], (err) => {
                                            if (err) reject(err);
                                        });
                                    }
                                }
                                else {
                                    if (row !== undefined) {
                                        const sql1 = "UPDATE status SET userName=?, filmId=null, filmTitle=null WHERE userId=?;";
                                        db.run(sql1, [userRow.name, userRow.id], (err) => {
                                            if (err) reject(err);
                                        });
                                    } else {
                                        const sql2 = "INSERT INTO status(userId, username) VALUES (?, ?, ?, ?);";
                                        db.run(sql2, [userRow.id, userRow.name], (err) => {
                                            if (err) reject(err);
                                        });
                                    }
                                }


                                const sql = "SELECT * FROM status WHERE userId=?;";
                                db.get(sql, [userRow.id], (err, row) => {
                                    if(err) reject(err);
                                    else resolve(row);
                                })
                            }
                        });
                    }
                });
            }
        });
    });
}