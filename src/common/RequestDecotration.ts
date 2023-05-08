
export class RequestDecorator {
    private readonly maxLimit:number = 3
    private requestQueue = []
    private currentConRequestNumber:number

    constructor(maxLimit:number) {
      this.maxLimit = maxLimit
    }

    async request(caller:Function) {
      if (this.currentConRequestNumber >= this.maxLimit) {
        await this.waitRequesting()
      }

      try {
        this.currentConRequestNumber++
        const result = await caller()
        return Promise.resolve(result)
      } catch (error) {
        return Promise.reject(error)
      } finally {
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
