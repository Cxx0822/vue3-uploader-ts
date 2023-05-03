const oproto = Object.prototype
const aproto = Array.prototype
const serialize = oproto.toString

const isFunction = function(fn) {
  return serialize.call(fn) === '[object Function]'
}

const isArray = Array.isArray || /* istanbul ignore next */ function(ary) {
  return serialize.call(ary) === '[object Array]'
}

const isPlainObject = function(obj) {
  return serialize.call(obj) === '[object Object]' && Object.getPrototypeOf(obj) === oproto
}

let i = 0

export class UploadUtils {
  static uid():number {
    return ++i
  }

  static extend() {
    let options
    let name
    let src
    let copy
    let copyIsArray
    let clone
    let target = arguments[0] || {}
    let i = 1
    const length = arguments.length
    let force = false

    // 如果第一个参数为布尔,判定是否深拷贝
    if (typeof target === 'boolean') {
      force = target
      target = arguments[1] || {}
      i++
    }

    // 确保接受方为一个复杂的数据类型
    if (typeof target !== 'object' && !isFunction(target)) {
      target = {}
    }

    // 如果只有一个参数，那么新成员添加于 extend 所在的对象上
    if (i === length) {
      target = this
      i--
    }

    for (; i < length; i++) {
      // 只处理非空参数
      if ((options = arguments[i]) != null) {
        for (name in options) {
          src = target[name]
          copy = options[name]

          // 防止环引用
          if (target === copy) {
            continue
          }
          if (force && copy && (isPlainObject(copy) || (copyIsArray = isArray(copy)))) {
            if (copyIsArray) {
              copyIsArray = false
              clone = src && isArray(src) ? src : []
            } else {
              clone = src && isPlainObject(src) ? src : {}
            }
            target[name] = this.extend(force, clone, copy)
          } else if (copy !== undefined) {
            target[name] = copy
          }
        }
      }
    }
    return target
  }

  noop() {

  }

  bind(fn:Function, context:any):Function {
    return function() {
      return fn.apply(context, arguments)
    }
  }

  preventEvent(evt:Event) {
    evt.preventDefault()
  }

  stop(evt:Event) {
    evt.preventDefault()
    evt.stopPropagation()
  }

  nextTick(fn:Function, context:any) {
    setTimeout(this.bind(fn, context), 0)
  }

  toArray(ary:Array<any>, start:number | undefined, end:number | undefined):Array<any> {
    if (start === undefined) start = 0
    if (end === undefined) end = ary.length
    return ary.slice(start, end)
  }
}

const utils = {

  isPlainObject: isPlainObject,
  isFunction: isFunction,
  isArray: isArray,

  formatSize: function(size) {
    if (size < 1024) {
      return size.toFixed(0) + ' bytes'
    } else if (size < 1024 * 1024) {
      return (size / 1024.0).toFixed(0) + ' KB'
    } else if (size < 1024 * 1024 * 1024) {
      return (size / 1024.0 / 1024.0).toFixed(1) + ' MB'
    } else {
      return (size / 1024.0 / 1024.0 / 1024.0).toFixed(1) + ' GB'
    }
  },

  defineNonEnumerable: function(target, key, value) {
    Object.defineProperty(target, key, {
      // 不可枚举 即不能用于遍历等操作 类似于私有属性
      enumerable: false,
      configurable: true,
      writable: true,
      value: value
    })
  }
}

module.exports = utils
