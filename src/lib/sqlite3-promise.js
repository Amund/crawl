// https://www.scriptol.com/sql/sqlite-async-await.php
import sqlite3 from 'sqlite3'

class sqlite {
    db = null

    open(path) {
        return new Promise((resolve) => {
            this.db = new sqlite3.Database(path, function (err) {
                if (err) reject('Open error: ' + err.message)
                else resolve(path + ' opened')
            })
        })
    }

    // any query: insert/delete/update
    run(query) {
        return new Promise((resolve, reject) => {
            this.db.run(query, function (err) {
                if (err) reject(err.message)
                else resolve(true)
            })
        })
    }

    // first row read
    get(query, params) {
        return new Promise((resolve, reject) => {
            this.db.get(query, params, function (err, row) {
                if (err) reject('Read error: ' + err.message)
                else {
                    resolve(row)
                }
            })
        })
    }

    // set of rows read
    all(query, params) {
        return new Promise((resolve, reject) => {
            if (params == undefined) params = []

            this.db.all(query, params, function (err, rows) {
                if (err) reject('Read error: ' + err.message)
                else {
                    resolve(rows)
                }
            })
        })
    }

    // each row returned one by one
    each(query, params, action) {
        return new Promise((resolve, reject) => {
            var db = this.db
            db.serialize(function () {
                db.each(query, params, function (err, row) {
                    if (err) reject('Read error: ' + err.message)
                    else {
                        if (row) {
                            action(row)
                        }
                    }
                })
                db.get('', function (err, row) {
                    resolve(true)
                })
            })
        })
    }

    close() {
        return new Promise((resolve, reject) => {
            this.db.close()
            resolve(true)
        })
    }
}

export default sqlite
