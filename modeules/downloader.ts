import axios, { AxiosInstance } from "axios"
import fs from "fs"
import { app } from "electron"
import { DownloaderHelper } from "node-downloader-helper"
import * as  path from 'path'


export class Downloader {



    url: string
    threadCount: number
    referer
    name: string
    path: string
    directory: string

    cancels = []

    totalsize = 0
    chunkSize = 0
    downloaded = 0

    bytespers = 0
    progressCount = 0
    progress = 0

    threads: any[] = []

    lastWrited = -1
    canceled = false
    error = false
    downloading = false

    onProgress
    onCompleted
    onError

    progressInterval: any
    instance: AxiosInstance
    cancelerInterval: NodeJS.Timeout | null = null

    constructor(url: string, name: string, threadCount: number, referer: string, onProgress: any, onCompleted: any, onError: any) {
        this.url = url
        this.threadCount = threadCount
        this.referer = referer
        this.name = name.replace(/:/g, "")
        this.path = path.normalize(path.join(app.getPath("downloads"), "AnimeciX", this.name))

        this.directory = path.join(app.getPath("downloads"), "AnimeciX")
        this.onProgress = onProgress
        this.onCompleted = onCompleted
        this.onError = onError

        const https = require('https')


        this.instance = axios.create({
            httpsAgent: new https.Agent({
                rejectUnauthorized: false
            })
        });

        this.startInterval();

    }

    pri = 0
    private startInterval() {
        if (this.progressInterval != null) {
            clearInterval(this.progressInterval)
            this.progressInterval = null
        }


        this.progressInterval = setInterval(() => {
            console.log("YES " + this.pri);
            this.pri++;
            if (this.downloading) {
                let speed = 0;
                let progress = 0
                for (var i = 0; i < this.threads.length; i++) {
                    speed += this.threads[i].speed
                    progress += this.threads[i].progress
                }
                this.onProgress({
                    speed: speed,
                    progress: (progress / this.threads.length),
                    canceled: this.canceled
                })
            }
        }, 1000)
    }


    public isDownloading() {
        return this.downloading
    }

    public isCanceled() {
        return this.canceled
    }

    public start() {
        this.canceled = false
        this.error = false
        this.checkSize()
        this.downloading = true
        if (this.progressInterval == null) {
            this.startInterval()
        }
        console.log("START CALLED")
    }

    public cancel() {
        this.canceled = true
        this.destroy()
    }

    checkSize() {
        let headers: any = {


        }
        if (this.referer != null) {
            headers["Referer"] = this.referer
            headers["User-Agent"] = "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:70.0) Gecko/20100101 Firefox/70.0"

        }
        this.instance.get(this.url, {
            headers: headers,
            responseType: 'stream'
        }).then(response => {
            this.totalsize = response.headers['content-length']
            console.log(this.totalsize)
            this.checkParts()
        }).catch(e => {
            if (this.downloading) {
                this.onError(e)
                this.downloading = false
                this.error = true
                if (this.cancelerInterval != null) {
                    clearInterval(this.cancelerInterval)
                    this.cancelerInterval = null;
                }
                this.destroy()
            }
            console.log(e)
        })
    }

    checkParts() {
        let first = 0

        this.chunkSize = Math.round(this.totalsize / this.threadCount)

        for (let i = 0; i < this.threadCount; i++) {



            let start = i * this.chunkSize
            let end = ((i + 1) * this.chunkSize) - 1

            if (end > this.totalsize) {
                end = this.totalsize
            }

            let thread = {
                id: i,
                start: start,
                end: end,
                finished: false,
                writed: false,
                writeFinished: false,
                path: "",
                speed: 0,
                progress: 0
            }

            this.threads.push(thread)

            first = end
        }

        //  console.log("TOTAL", this.totalsize)
        //  console.log("CHUNK", this.chunkSize)
        //  console.log("PARTS", this.threads)

        this.downloadParts()
    }

    downloadParts() {
        console.log("download parts")

        if (!fs.existsSync(this.directory)) {
            fs.mkdirSync(this.directory)
        }

        this.threads.forEach(thread => {
            console.log("thread start")
            let downloadPath = this.path + "__" + thread.id + ".befw"
            let fileName = this.name + "__" + thread.id + ".befw"
            thread.path = downloadPath
            let headers: any = {

                "Range": "bytes=" + thread.start + "-" + thread.end
            }

            if (this.referer != null) {
                headers["Referer"] = this.referer
                headers["User-Agent"] = "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:70.0) Gecko/20100101 Firefox/70.0"

            }

            /*const Downloader = require('nodejs-file-downloader')
            const downloader = new Downloader({
                url: this.url,
                directory: this.directory,
                fileName: fileName,
                headers: headers,
                onProgress: (percentage, chunk, remainingSize) => {

                    this.onProgress(percentage, chunk, remainingSize)

                }
            })*/

            const dl = new DownloaderHelper(this.url, this.directory, {
                fileName: fileName,
                headers: headers,
                retry: true,
                httpsRequestOptions: {
                    rejectUnauthorized: false
                },
                override: true,
            })

            dl.start()

            dl.on('progress', (stats) => {

                thread.speed = stats.speed
                thread.progress = stats.progress

            })

            dl.on('end', (stats) => {
                thread.finished = true
                this.checkWrite()
            })

            dl.on('error', (stats) => {
                if (this.downloading) {
                    this.onError(stats)
                    this.downloading = false
                    this.error = true
                    if (this.cancelerInterval != null) {
                        clearInterval(this.cancelerInterval)
                        this.cancelerInterval = null;
                    }
                    this.destroy()
                }
            })


            /*downloader.download().then(() => {
                thread.finished = true
                this.checkWrite()
            }).catch(error => {
                console.log(error)
                this.onError(error)
                this.downloading = false
            })*/
            if (this.cancelerInterval == null) {
                this.cancelerInterval = setInterval(() => {
                    if (this.canceled) {
                        //downloader.cancel()
                        try {
                            dl.stop()
                        } catch (e) {

                        }
                        this.downloading = false
                        if (this.cancelerInterval != null) {
                            clearInterval(this.cancelerInterval)
                            this.cancelerInterval = null
                        }
                        this.onError("Canceled")
                        console.log("canceled")
                    }
                }, 1)
            }

        })
    }

    checkWrite() {

        this.threads.forEach(thread => {


            if (this.canceled) {

                return;
            }

            try {
                if (thread.finished && !thread.writed && this.lastWrited + 1 == thread.id) {
                    var w = fs.createWriteStream(this.path, { flags: 'a' });

                    var r = fs.createReadStream(thread.path);

                    w.on('close', () => {
                        thread.writeFinished = true
                        try {
                            fs.unlinkSync(thread.path)
                        } catch (e) {

                        }
                        this.lastWrited++
                        this.checkEnd()
                    });

                    r.pipe(w);
                    thread.writed = true

                }
            } catch (e) {
                this.onError(e)
                this.downloading = false
            }

        })

    }

    checkEnd() {
        let allEnded = true
        this.threads.forEach(thread => {
            if (!thread.writeFinished) {
                allEnded = false
            }
        })
        if (allEnded) {
            console.log("Completed!")
            this.onCompleted()
            this.downloading = false
            this.destroy()
        } else {
            this.checkWrite()
        }
    }

    destroy() {
        if (this.progressInterval != null) {
            clearInterval(this.progressInterval)
            this.progressInterval = null;
        }
    }

}