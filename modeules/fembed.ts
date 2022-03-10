import axios from "axios"

export class Fembed {

    private sources: any;

    constructor(public url: string, public onFinish:any, public onError:any) {

    }

    public found() {
        this.first().then(
            sources => {
                this.onFinish(sources)
            }
        ).catch(e => {
            this.onError(e)
        })
    }


    private async first() {
        let data = (await axios.get(this.url)).data
        const userId = parseInt(data.split(`var USER_ID = '`)[1].split(`'`)[0])

        const sourceData = await this.second()
        this.sources = sourceData.data

        return await new Promise((resolve, reject) => {
            setTimeout(() => {
                console.log(userId)
                axios.post("https://v3.fstats.xyz/watch", {
                    data: JSON.stringify({
                        id: this.getVideoId(),
                        user: userId,
                        ref: "",
                        vip: 0
                    })
                }).then(response => {
                    resolve(this.sources)
                }).catch(e => {
                    reject(e)
                })
            }, 2000)
        })


    }

    private async second() {
        return (await axios.post("https://femax20.com/api/source/" + this.getVideoId(), {
            r: "",
            d: "femax20.com"
        })).data
    }

    private getVideoId() {
        return this.url.split("/v/")[1].split("/")[0].split("#")[0].split("?")[0]
    }

}