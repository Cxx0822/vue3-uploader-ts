import { Chunk } from './chunk'

export class RequestDecorator {
    private readonly maxLimit:number = 3
    private requestQueue = []
    private currentConRequestNumber:number

    constructor(maxLimit:number) {
      this.maxLimit = maxLimit
      this.currentConRequestNumber = 0
    }

    async request(chunk:Chunk) {
      if (this.currentConRequestNumber >= this.maxLimit) {
        await this.waitRequesting()
      }

      try {
        this.currentConRequestNumber++
        chunk.startTime = Date.now()
        const result = await chunk.sendChunkData()
        return Promise.resolve(result)
      } catch (error) {
        return Promise.reject(error)
      } finally {
        console.log('当前并发数:', this.currentConRequestNumber)
        this.currentConRequestNumber--
        this.nextRequesting()
      }
    }

    waitRequesting() {
      let _resolve
      const promise = new Promise((resolve) => { _resolve = resolve })
      this.requestQueue.push(_resolve)
      return promise
    }

    nextRequesting() {
      if (this.requestQueue.length <= 0) return

      const resolve = this.requestQueue.shift()
      resolve()
    }
}
