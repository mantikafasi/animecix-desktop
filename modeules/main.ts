import axios from "axios"
import { BrowserWindow, app, ipcMain, session, WebFrameMain, shell, Notification } from "electron"
import { Sibnet } from "./sibnet"
import path from 'path'
import { Downloader } from "./downloader";
import { autoUpdater } from "electron-updater";
import { ElectronBlocker } from "@cliqz/adblocker-electron";
const DiscordRPC = require('discord-rpc');

export class Main {
    win: BrowserWindow | null = null
    currentFrameUrl: string | null = null
    currentFrame: WebFrameMain | null = null

    loaderScript: any

    isOdnok: any

    fileForDownload: any

    sources: any
    standart: any
    cancels: any[] = []

    downloads: any[] = []

    identifier: any

    intervals: any[] = []
    downloadsWindow: BrowserWindow | null = null;

    sendToWindow(key: any, val: any = null) {
        if (this.win != null && !this.win.isDestroyed()) {
            this.win.webContents.send(key, val)
        }
        if (this.downloadsWindow != null && !this.downloadsWindow.isDestroyed()) {
            this.downloadsWindow.webContents.send(key, val)
        }
    }

    getDownloadUrl(url: string) {
        if (url.includes("mycdn")) {
            return url.replace(/\.mp4/g, "")
        }
        return url
    }

    array_move(arr: any[], old_index: number, new_index: number) {
        if (new_index >= arr.length) {
            var k = new_index - arr.length + 1;
            while (k--) {
                arr.push(undefined);
            }
        }
        arr.splice(new_index, 0, arr.splice(old_index, 1)[0]);
        return arr;
    };

    paused: boolean = false
    checkStart() {
        if (this.paused) {
            return;
        }
        let started = false;
        let i = 0;
        this.downloads.forEach((downloadObj: any) => {
            if (!downloadObj.downloader.isDownloading() && !downloadObj.downloader.isCanceled() && !downloadObj.downloader.error && !started && downloadObj.status != 'completed') {
                if (i != 0) {
                    this.array_move(this.downloads, i, 0)
                    this.checkStart()
                } else {
                    downloadObj.downloader.start()
                    const notification = new Notification({ icon: path.join(this.dir, "files", "icon.png"), title: "İndiriliyor", body: downloadObj.name })
                    notification.on('click', () => {
                        if (this.win != null && !this.win.isDestroyed()) {
                            this.sendToWindow("showDownloads")
                        }
                    })
                    notification.show()
                    started = true;
                }
            } else if (downloadObj.downloader.isDownloading()) {
                started = true
            }
            i++;
        })
    }

    updateDownloads(obj: any) {
        let index = this.downloads.map(item => {
            return item.name
        }).indexOf(obj.name)
        if (index > -1) {
            this.downloads[index] = obj
        } else {
            this.downloads.push(obj)
        }
        this.checkStart()

    }

    constructor(public dir: any) {
        this.intervals.push(setInterval(() => {
            this.sendDownloads()
        }, 500))

        this.intervals.push(setInterval(() => {
            this.checkStart()
        }, 2000))
    }

    getHostname(url: any) {
        try {
            return new URL(url).hostname
        } catch (e) {
            return "notvalid"
        }
    }

    sendDownloads() {
        if (this.win != null && !this.win.isDestroyed() && app.isReady()) {
            this.sendToWindow('downloadItems', this.downloads.map(item => {
                let obj: any = {
                    name: item.name,
                    progress: Math.round(item.progress),
                    status: item.status,
                    statusText: item.statusText,
                    url: item.url
                }
                return obj
            }))
            this.sendToWindow("paused", this.paused)
        }
    }

    getReferer() {
        return this.isOdnok ? null : this.currentFrameUrl
    }
    client = new DiscordRPC.Client({ transport: 'ipc' });

    fixTime(time: number): String {
        if (time < 10) {
            return "0" + time;
        }
        return time.toString();
    }

    updateRPC(data: any) {
        var startTimestamp = new Date(data.position * 1000);

        var timeLeft: any = new Date(Date.now() + 1000*(data.duration - data.position) );

        var endTimestamp: any = new Date(data.duration * 1000);

        var startTimeString = "";
        var endTimeString = "";
        var smallImageKey, smallImageText = "";

        // Baya spagetti biliyorum ama yapcak daha iyi bi yöntem bulamadım
        if (startTimestamp.getUTCHours() > 0) startTimeString += startTimestamp.getUTCHours() + ":";
        if (endTimestamp.getUTCHours() > 0) endTimeString += endTimestamp.getUTCHours() + ":";
        startTimeString += this.fixTime(startTimestamp.getMinutes()) + ":";
        startTimeString += this.fixTime(startTimestamp.getSeconds());
        endTimeString += this.fixTime(endTimestamp.getMinutes()) + ":";
        endTimeString += this.fixTime(endTimestamp.getSeconds());

        var stateString = startTimeString + " / " + endTimeString;

        if (data.state) {
            smallImageKey = "play"
            smallImageText = "Oynatılıyor"
        } else {
            smallImageKey = "pause"
            smallImageText = "Durduruldu"
            timeLeft = null;
        }

        this.client.setActivity({
            details: data.title,
            endTimestamp: timeLeft,
            state: stateString,
            largeImageKey: 'animecix',
            largeImageText: 'Animecix',
            smallImageKey: smallImageKey,
            smallImageText: smallImageText,
            instance: false,
        });
    }

    run() {
        app.on("ready", () => {

            // Discord RPC ye client id ile giriş yap
            this.client.login({ clientId : '950857480781590548' });

            app.setAppUserModelId("AnimeciX")
            this.win = new BrowserWindow({
                webPreferences: {
                    nodeIntegration: true,
                    webSecurity: false, // iframe içine erişemediğim için devre dışı bırakmak zorunda kaldım.
                    contextIsolation: false,
                    nodeIntegrationInSubFrames: true,
                    preload: this.dir + "/files/preload.js",
                    nativeWindowOpen: true
                },
                title: "AnimeciX",
                icon: path.join(this.dir, "files", "icon.png"),
                frame: false
            })

            this.win.on("page-title-updated", () => {
                this.client.setActivity({
                    details: `Dolanıyo`,
                    state: this.win?.getTitle(),
                    largeImageKey: 'animecix',
                    largeImageText: 'Animecix',
                    instance: false,
                });
            })

            this.win.maximize()

            autoUpdater.checkForUpdatesAndNotify();

            autoUpdater.on('update-available', () => {
                if (this.win != null && !this.win.isDestroyed()) {
                    const notification = new Notification({ icon: path.join(this.dir, "files", "icon.png"), title: "AnimeciX Güncelleniyor...", body: "Güncelleme indiriliyor" })

                    notification.show()
                    this.win.webContents.loadURL("https://animecix.com/windows/update.html")
                }
            });
            autoUpdater.on('update-downloaded', () => {
                const notification = new Notification({ icon: path.join(this.dir, "files", "icon.png"), title: "AnimeciX Güncelleniyor...", body: "Güncelleme Kuruluyor" })

                notification.show()
                autoUpdater.quitAndInstall()
            });

            autoUpdater.on('download-progress', (data) => {
                if (this.win != null && !this.win.isDestroyed()) {
                    this.win.webContents.send("update-download-progress", data)
                }
            });

            const filter = {
                urls: ['*://*/*']
            }

            ElectronBlocker.fromPrebuiltAdsAndTracking(require('node-fetch')).then((blocker) => {
                blocker.enableBlockingInSession(session.defaultSession)
            })


            session.defaultSession.webRequest.onBeforeSendHeaders(filter, (details: any, callback) => {
                if (!this.isOdnok) {
                    if (!details.url.includes("disqus")) {
                        details.requestHeaders['Referer'] = this.currentFrameUrl
                    }
                    details.requestHeaders['User-Agent'] = "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:70.0) Gecko/20100101 Firefox/70.0"
                } else {
                    if (details.url.includes("google")) {
                        details.requestHeaders['User-Agent'] = "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:70.0) Gecko/20100101 Firefox/70.0"
                    } else {
                        details.requestHeaders['User-Agent'] = "axios 1.0"
                    }
                }
                callback({ requestHeaders: details.requestHeaders })
            })

            session.defaultSession.webRequest.onBeforeRequest(filter, (details, callback) => {
                let url = ""
                if (this.isOdnok && details.url.includes("mycdn") && details.url.includes(".mp4")) {
                    url = details.url.replace(/\.mp4/g, "")
                    callback({ redirectURL: url })
                } else {
                    callback({})
                }
            })

            this.win.webContents.setWindowOpenHandler(({ url }) => {
                console.log("OPEN", url)
                if (url.includes("disqus") || url.includes("animecix") || url.includes("google")) {
                    return {
                        action: 'allow',
                        overrideBrowserWindowOptions: {
                            frame: true,
                            autoHideMenuBar: true,
                            fullscreenable: false,
                            backgroundColor: 'black',
                            webPreferences: { }
                        }
                    }
                }
                return { action: 'deny' }
            })

            this.win.webContents.on('did-create-window', (window) => {
                window.webContents.setUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:70.0) Gecko/20100101 Firefox/70.0")
            })

            this.win.on("enter-full-screen", () => {
                if (this.win != null) {
                    this.win.setMenuBarVisibility(false)
                }
            })


            this.win.on("leave-full-screen", () => {
                if (this.win != null) {
                    this.win.setMenuBarVisibility(true)
                }
            })

            this.win.on("close", () => {
                app.exit()
                this.intervals.forEach(element => {
                    clearInterval(element)
                });

                this.win = null
            })
            //this.win.webContents.session.clearCache()

            this.win.loadURL("https://animecix.com")

            //this.win.webContents.openDevTools()

            ipcMain.on("setPaused", (event, paused) => {
                this.paused = paused
            })

            ipcMain.on("getDetails", (event, ok) => {
                event.sender.send("details", this.currentFrameUrl, this.identifier)
                if (this.win != null) {
                    this.win.webContents.mainFrame.frames.forEach(frame => {
                        frame.send("details", this.currentFrameUrl, this.identifier)
                    });

                    console.log("executing")
                    this.win?.webContents.executeJavaScript(` 

                    var interval =setInterval(()=>{
                        var iframe = document.getElementById("iframe").contentDocument || document.getElementById("iframe").contentWindow.document
                        var jwp = iframe.getElementsByClassName("jw-video")[0];
                        if (jwp != null) {
                            var title = document.getElementsByClassName("title")[0].innerText;
                            const ipcRenderer = nodeRequire('electron').ipcRenderer

                            var updateTimeInterval = setInterval(()=>{
                                var title = document.getElementsByClassName("title")[0].innerText;
                                ipcRenderer.send("updateRPC", {duration:Math.floor(jwp.duration),position:Math.floor(jwp.currentTime),
                                title:title,state:!jwp.paused});
                            },10000);

                            ipcRenderer.send("updateRPC", {duration:Math.floor(jwp.duration),position:Math.floor(jwp.currentTime),
                                title:title,state:true});

                                jwp.onplay = function () {
                                    ipcRenderer.send("updateRPC", {duration:Math.floor(jwp.duration),position:Math.floor(jwp.currentTime),
                                    title:title,state:true});
                                };
                            
                            
                                jwp.onpause = function () {
                                    ipcRenderer.send("updateRPC", {duration:Math.floor(jwp.duration),position:Math.floor(jwp.currentTime),
                                    title:title,state:false});
                                };
                                clearInterval(interval)
                         } 
                         console.log("searched")
    
                    },1000)
                        `)
                }
            })

            ipcMain.on("Odnok", (event, ok) => {
                if (this.currentFrameUrl != null) {
                    axios.get(this.currentFrameUrl).then((response) => {
                        let str = response.data
                        try {
                            const HTMLParser = require('node-html-parser');
                            const { parse } = HTMLParser;

                            let parsed = parse(str);
                            let opt = parsed.querySelector('[data-module="OKVideo"]').getAttribute("data-options");
                            let data = JSON.parse(opt);
                            let metadata = JSON.parse(data.flashvars.metadata)
                            // console.log(metadata.videos)
                            this.sources = []
                            metadata.videos.forEach((element: any) => {
                                this.sources.push({
                                    label: element.name.toUpperCase().replace("MOBİLE", "144P")
                                        .replace("LOWEST", "240P")
                                        .replace("LOW", "360P")
                                        .replace("SD", "480P")
                                        .replace("HD", "720P HD")
                                        .replace("FULL", "1080P FHD"),
                                    file: element.url + ".mp4"
                                })
                            });
                            this.isOdnok = true
                            if (this.win != null && !this.win.isDestroyed()) {
                                this.win.webContents.mainFrame.frames.forEach(frame => {
                                    console.log(this.sources)
                                    frame.send("Sources", this.sources)
                                });
                            }
                        } catch (e) {
                            console.log(e)
                        }
                    }).catch(error => {
                        console.log(error)
                    })
                }
            })

            ipcMain.on("Setup", (event, ok) => {
                if (this.currentFrameUrl != null) {
                    Sibnet.found(this.currentFrameUrl, (video: any) => {
                        if (this.win != null && !this.win.isDestroyed()) {
                            this.win.webContents.mainFrame.frames.forEach(frame => {
                                frame.send("Standart", video)
                            });
                        }
                    })
                }

            })

            ipcMain.on("updateRPC", (event, data) => {
                this.updateRPC(data)
            })

            ipcMain.on("Standart", (event, file) => {
                this.standart = file
            })

            ipcMain.on("min", (event) => {
                if (this.win != null) {
                    this.win.minimize()
                }
            })

            ipcMain.on("max", (event) => {
                if (this.win != null) {
                    if (this.win.isMaximized()) {
                        this.win.unmaximize()
                    } else {
                        this.win.maximize()
                    }
                }
            })

            ipcMain.on("redo", (event) => {
                if (this.win != null) {
                    this.win.webContents.goForward()
                }
            })

            ipcMain.on("undo", (event) => {
                if (this.win != null) {
                    this.win.webContents.goBack()
                }
            })

            ipcMain.on("exit", (event) => {
                if (this.win != null) {
                    this.win.close()
                }
            })

            ipcMain.on("StandartSetup", (event, file) => {
                if (this.win != null && !this.win.isDestroyed()) {
                    this.win.webContents.mainFrame.frames.forEach(frame => {
                        frame.send("Standart", this.standart)
                    });
                }
            })

            ipcMain.on("Sources", (event, ok) => {
                if (this.win != null && !this.win.isDestroyed()) {
                    this.win.webContents.mainFrame.frames.forEach(frame => {
                        frame.send("Sources", this.sources)
                    });
                }
            })

            ipcMain.on("canDownload", (event, file) => {
                this.fileForDownload = file
                this.sendToWindow("canDownload", true)
                this.sendToWindow("sourcesForDownload", null)
                console.log("CAN DOWNLOAD", this.fileForDownload)
            })

            ipcMain.on("canDownloadSources", (event, sources) => {
                this.sources = sources
                this.sendToWindow("canDownload", true)
                this.sendToWindow("sourcesForDownload", this.sources)
                console.log("CAN DOWNLOAD", this.fileForDownload)
            })

            ipcMain.on("cancelDownloadVideo", (event, name) => {
                this.downloads.forEach(obj => {
                    if (obj.name == name) {
                        obj.downloader.cancel()
                    }
                    this.sendDownloads()
                })
            })

            ipcMain.on("removeDownload", (event, name) => {
                let index = this.downloads.map(obj => {
                    return obj.name
                }).indexOf(name)
                this.downloads.splice(index, 1)
                this.sendDownloads()
            })

            ipcMain.on("showDownloads", (event, ok) => {
                this.sendDownloads()
            })

            ipcMain.on("seeAll", (event, ok) => {
                shell.openPath(app.getPath("downloads") + "/AnimeciX/")
            })

            ipcMain.on("downloads", (event, data) => {
                if (this.downloadsWindow == null) {
                    this.downloadsWindow = new BrowserWindow({
                        webPreferences: {
                            nodeIntegration: true,
                            contextIsolation: false,
                            nodeIntegrationInSubFrames: true,
                            preload: this.dir + "/files/preload.js",
                        }
                    })
                    // this.downloadsWindow.webContents.openDevTools()
                    this.downloadsWindow.removeMenu()
                    this.downloadsWindow.loadURL("https://animecix.com/windows/downloads.html")
                    this.downloadsWindow.once('close', () => {
                        this.downloadsWindow = null;
                    })
                } else if (!this.downloadsWindow.isDestroyed()) {
                    this.downloadsWindow.focus()
                }
            })

            ipcMain.on("downloadSource", (event, video) => {
                const downloaderObj: any = {
                    downloader: null,
                    url: video.file,
                    name: video.name,
                    progress: 0,
                    speed: 0,
                    status: 'queried',
                    statusText: 'Sırada'
                }
                const downloader = new Downloader(this.getDownloadUrl(video.file), video.name, parseInt(video.threads), this.getReferer() as any, (stats: any) => {
                    if (stats.canceled) {
                        downloaderObj.status = 'failed'
                        if (downloader.isCanceled()) {
                            downloaderObj.statusText = 'İptal Edildi'
                        } else {
                            downloaderObj.statusText = 'İndirme Başarısız'
                        }
                    } else {
                        downloaderObj.progress = stats.progress
                        downloaderObj.status = 'downloading'
                        downloaderObj.statusText = (downloaderObj.speed / 1000000).toFixed(2) + " MB/s hızla indiriliyor"
                        downloaderObj.speed = stats.speed
                    }

                    this.updateDownloads(downloaderObj)
                }, () => {
                    downloaderObj.status = 'completed'
                    downloaderObj.statusText = 'İndirme Tamamlandı'
                    this.updateDownloads(downloaderObj)
                    this.sendNotificationIfAllDownloaded();
                }, (e: any) => {
                    downloaderObj.status = 'failed'
                    if (downloader.isCanceled()) {
                        downloaderObj.statusText = 'İptal Edildi'
                    } else {
                        downloaderObj.statusText = 'İndirme Başarısız'
                    }
                    this.updateDownloads(downloaderObj)
                })
                downloaderObj.downloader = downloader
                this.updateDownloads(downloaderObj)
            })

            ipcMain.on("downloadVideo", (event, video) => {
                const downloaderObj: any = {
                    downloader: null,
                    url: this.fileForDownload,
                    name: video.name,
                    progress: 0,
                    speed: 0,
                    status: 'queried',
                    statusText: 'Sırada'
                }
                const downloader = new Downloader(this.getDownloadUrl(this.fileForDownload), video.name, parseInt(video.threads), this.getReferer() as any, (stats: any) => {
                    if (stats.canceled) {
                        downloaderObj.status = 'failed'
                        if (downloader.isCanceled()) {
                            downloaderObj.statusText = 'İptal Edildi'
                        } else {
                            downloaderObj.statusText = 'İndirme Başarısız'
                        }
                    } else {
                        downloaderObj.progress = stats.progress
                        downloaderObj.status = 'downloading'
                        downloaderObj.statusText = (downloaderObj.speed / 1000000).toFixed(2) + " MB/s hızla indiriliyor"
                        downloaderObj.speed = stats.speed

                    }
                    this.updateDownloads(downloaderObj)
                }, () => {
                    downloaderObj.status = 'completed'
                    downloaderObj.statusText = 'İndirme Tamamlandı'
                    this.updateDownloads(downloaderObj)
                    this.sendNotificationIfAllDownloaded()

                }, (e: any) => {
                    downloaderObj.status = 'failed'
                    if (downloader.isCanceled()) {
                        downloaderObj.statusText = 'İptal Edildi'
                    } else {
                        downloaderObj.statusText = 'İndirme Başarısız'
                    }
                    this.updateDownloads(downloaderObj)
                })
                downloaderObj.downloader = downloader
                this.updateDownloads(downloaderObj)
            })

            ipcMain.on("nextEpisode", (event, ok) => {
                this.sendToWindow("nextEpisode", true)
            })

            ipcMain.on("playerError", (event, ok) => {
                this.sendToWindow("playerError", true)
            })

            ipcMain.on("retryDownload", (event, video) => {

                const downloaderObj: any = {
                    downloader: null,
                    name: video.name,
                    url: video.url,
                    progress: 0,
                    speed: 0,
                    status: 'queried',
                    statusText: 'Sırada'
                }
                const downloader = new Downloader(this.getDownloadUrl(video.url), video.name, parseInt(video.threads), this.getReferer() as any, (stats: any) => {
                    downloaderObj.progress = stats.progress
                    downloaderObj.status = 'downloading'
                    downloaderObj.statusText = (downloaderObj.speed / 1000000).toFixed(2) + " MB/s hızla indiriliyor"
                    downloaderObj.speed = stats.speed
                    this.updateDownloads(downloaderObj)
                }, () => {
                    downloaderObj.status = 'completed'
                    downloaderObj.statusText = 'İndirme Tamamlandı'
                    this.updateDownloads(downloaderObj)
                }, (e: any) => {
                    downloaderObj.status = 'failed'
                    if (downloader.isCanceled()) {
                        downloaderObj.statusText = 'İptal Edildi'
                    } else {
                        downloaderObj.statusText = 'İndirme Başarısız'
                    }
                    this.updateDownloads(downloaderObj)
                })
                downloaderObj.downloader = downloader
                this.updateDownloads(downloaderObj)
            })


            ipcMain.on('moveDownloads', (evt, a, b) => {
                if (b != 1 && a != 1) {
                    this.array_move(this.downloads, a, b)
                }
            })

            ipcMain.on("Fembed", (event, sourceString) => {
                this.sources = JSON.parse(sourceString)
                console.log(this.sources)
            })

            ipcMain.on("updateCurrent", (event, currentUrl, identifier) => {
                this.currentFrameUrl = currentUrl
                if (identifier != null) {
                    this.identifier = identifier
                }
                this.isOdnok = false
                console.log("UPDATE!", currentUrl)
            })
        })
    }
    sendNotificationIfAllDownloaded() {
        if (this.downloads.filter(item => (item.status == 'downloading' || item.status == 'queried')).length == 0) {
            const completed = this.downloads.filter(item => item.status == 'completed').length;
            const notification = new Notification({ icon: path.join(this.dir, "files", "icon.png"), title: "Tüm indirmeler tamamlandı", body: completed + " dosya indirildi." })
            notification.on('click', () => {
                if (this.win != null && !this.win.isDestroyed()) {
                    this.sendToWindow("showDownloads")
                }
            })
            notification.show()
        }
    }
}