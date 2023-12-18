'use strict';

const db = require('../components/db');
const Image = require('../components/image');
const PROTO_PATH = __dirname + '/../proto/conversion.proto';
const REMOTE_URL = 'localhost:50051';
const grpc = require('@grpc/grpc-js');
const protoLoader = require('@grpc/proto-loader');
var fs = require('fs');

let packageDefinition = protoLoader.loadSync(
    PROTO_PATH,
    { keepCase: true,
        longs: String,
        enums: String,
        defaults: true,
        oneofs: true
    });

let vs = grpc.loadPackageDefinition(packageDefinition).conversion;
let client = new vs.Converter(REMOTE_URL, grpc.credentials.createInsecure());


exports.addImage = function(filmId, file, owner) {
    return new Promise((resolve, reject) => {
        const sql1 = "SELECT owner FROM films f WHERE f.id = ? AND f.private = 0";
        db.all(sql1, [filmId], (err, rows) => {
            if (err)
                reject(err);
            else if (rows.length === 0)
                reject(404);
            else if(owner !== rows[0].owner) {
                reject(403);
            }
            else {
                let name = file.filename;
                let canonic = name.substring(0, name.lastIndexOf('.'));
                let extension = name.substring(name.lastIndexOf('.'), name.length).replace('.', '').toLowerCase();
                if(extension !== 'jpg' && extension !== 'png' && extension !== 'gif'){
                    reject(415);
                    return;
                }

                const sql2 = "INSERT INTO images(filmId, name) VALUES (?, ?)";
                db.run(sql2, [filmId, canonic], function (err) {
                  if(err) { reject(err); }
                  else {
                      resolve(new Image(this.lastID, filmId, canonic));
                  }
                });
            }
        });
    });
}

exports.getImages = function(filmId, owner) {
    return new Promise( (resolve, reject) => {
        const sql1 = "SELECT owner FROM films as F, reviews as R WHERE F.id = ? AND (F.id = R.filmId) AND (F.owner = ? OR R.reviewerId = ?);";
        db.all(sql1, [filmId, owner, owner], function(err, rows) {
           if(err) reject(err);
           if(rows.length <= 0) reject(403);
           else {
               const sql2 = "SELECT filmId, imageId, name FROM images as I, films as F WHERE F.id = I.filmId AND F.private = 0 AND F.id = ?";
               db.all(sql2, [filmId], function(err, rows) {
                   if(err) reject(err);
                   else resolve(rows.map( row => new Image(row.imageId, row.filmId, row.name)));
               });
           }
        });


    });
}

exports.getSingleImage = function(filmId, imageType, imageId, owner) {
    return new Promise( (resolve, reject) => {
        const sql1 = "SELECT owner FROM films as F, reviews as R WHERE F.id = ? AND (F.id = R.filmId) AND (F.owner = ? OR R.reviewerId = ?);";
        db.all(sql1, [filmId, owner, owner], function(err, rows) {
            if(err) reject(err);
            if(rows.length <= 0) reject(403);
            else {
               const sql2 = 'SELECT * FROM images WHERE filmId=? AND imageId=?;';
               db.get(sql2, [filmId, imageId], async function(err, row) {
                   if(err) reject(err);
                   if(row === undefined) reject(404);
                   else {
                       if(imageType === "json") {
                           resolve(new Image(imageId, filmId, row.name));
                       }
                       else {
                           const types = ["png", "jpg", "gif"];
                           let name = row.name;
                           let filename = name + "." + imageType;
                           let pathFile = __dirname + '/../uploads/' + filename;

                           try {
                               if (fs.existsSync(pathFile)) {
                                   resolve(filename);
                               } else {
                                   let other_types = types.filter(type => type !== imageType);
                                   let pathFile2 = __dirname + '/../uploads/' + name + "." + other_types[0];
                                   let pathFile3 = __dirname + '/../uploads/' + name + "." + other_types[1];
                                   let originFile = null;
                                   let originType = null;
                                   try {
                                       if (fs.existsSync(pathFile2)) {
                                           originFile = pathFile2;
                                           originType = other_types[0];
                                       }
                                       if (fs.existsSync(pathFile3)) {
                                           originFile = pathFile3;
                                           originType = other_types[1];
                                       }
                                       if (originFile === null) {
                                           reject(404);
                                       }
                                       await convertImage(originFile, pathFile, originType, imageType);
                                       resolve(filename);
                                   } catch (err) {
                                       reject(err);
                                   }
                               }
                           } catch (err) {
                               reject(err);
                           }
                       }
                   }
               })
            }
        });


    });
}

exports.deleteSingleImage = function(filmId, imageId, owner) {
    return new Promise( (resolve, reject) => {
        const sql1 = "SELECT owner FROM films as F, reviews as R WHERE F.id = ? AND (F.id = R.filmId) AND (F.owner = ? OR R.reviewerId = ?);";
        db.all(sql1, [filmId, owner, owner], function(err, rows) {
            if (err) reject(err);
            if (rows.length === 0) reject(404);
            else {
                console.log(filmId, imageId);
                const sql2 = "SELECT * FROM images WHERE filmId=? AND imageId=?;";
                db.get(sql2, [filmId, imageId], function(err, row) {
                   if(err) reject(err);
                   if(row === undefined) reject(404);
                   else {
                       let canonic = row.name;
                       db.run("DELETE FROM images WHERE filmId=? AND imageId=? AND name=?;", [filmId, imageId, canonic], function(err, row) {
                          if(err) reject(err);
                          else {
                              let pathFile1 = './uploads/' + canonic + '.png';
                              let pathFile2 = './uploads/' + canonic + '.jpg';
                              let pathFile3 = './uploads/' + canonic + '.gif';
                              if (fs.existsSync(pathFile1)) {
                                  fs.unlinkSync(pathFile1);
                              }
                              if (fs.existsSync(pathFile2)) {
                                  fs.unlinkSync(pathFile2);
                              }
                              if (fs.existsSync(pathFile3)) {
                                  fs.unlinkSync(pathFile3);
                              }
                              resolve();
                          }
                       });

                   }
                });
            }
        });

    });
}

function convertImage(originFile, pathFile, originType, imageType) {
    return new Promise((resolve, reject) => {
        // Open the gRPC call with the gRPC server
       let call = client.fileConvert();

       //set the callback to receive back the file
        let wstream = fs.createWriteStream(pathFile);
        let success = false;
        let error = "";
        call.on('data', function(data){

            //receive meta data
            if(data.meta !== undefined){
                success = data.meta.success;

                if(success === false){
                    error = data.meta.error;
                    reject(error);
                }
            }

            //receive file chunck
            if(data.file !== undefined){
                wstream.write(data.file);
            }

        });

        // Set callback to end the communication and close the write stream
        call.on('end',function(){
            wstream.end();
        })

        // Send the conversion types for the file (when the gRPC client is integrated with the server of Lab01, the file_type_origin and file_type_target will be chosen by the user)
        call.write({ "meta": {"file_type_origin": originType, "file_type_target": imageType}});

        // Send the file
        const max_chunk_size = 1024; //1KB
        const imageDataStream = fs.createReadStream(originFile, {highWaterMark: max_chunk_size});

        imageDataStream.on('data', (chunk) => {
            call.write({"file": chunk });
        });

        // When all the chunks of the image have been sent, the clients stops to use the gRPC call from the sender side
        imageDataStream.on('end', () => {
            call.end();
        });

        // Only after the write stream is closed,the promise is resolved (otherwise race conditions might happen)
        wstream.on('close',function(){
            resolve();
        })
    });
}

