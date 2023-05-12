/**
 * 格式化秒 小时:分钟:秒
 @param {number} second 传入的需要转换的并且时间单位为秒的值
 @param {number} [secondPrecision=0] 保留的秒数的精度
 @param {boolean} [roundSecond=false] 是否对秒数进行四舍五入
 @returns {string} 返回的格式化后的时间字符串
 */
export const formatMillisecond = (
  second: number,
  secondPrecision = 0,
  roundSecond = false
) => {
  const hours = Math.floor(second / 3600)
  const minutes = Math.floor((second - hours * 3600) / 60)
  let seconds = second - hours * 3600 - minutes * 60

  if (roundSecond) {
    seconds = Math.round(seconds)
  }

  let secondsStr = seconds.toFixed(secondPrecision)
  if (Number.parseInt(secondsStr) <= 9) {
    secondsStr = `0${secondsStr}`
  }
  return `${hours}:${minutes}:${secondsStr}`
}

/**
 * 格式化文件大小 自适应调整为B KB MB GB等
 * @param size 文件大小 单位B
 * @param digits 保留的小数 默认为2位
 */
export function formatFileSize(size:number, digits:number = 2) {
  if (size < 1024) {
    return size + 'B'
  } else if (size >= 1024 && size < Math.pow(1024, 2)) {
    return parseFloat(<string>(size / 1024)).toFixed(digits) + 'KB'
  } else if (size >= Math.pow(1024, 2) && size < Math.pow(1024, 3)) {
    return parseFloat(<string>(size / Math.pow(1024, 2))).toFixed(digits) + 'MB'
  } else if (size > Math.pow(1024, 3)) {
    return parseFloat(<string>(size / Math.pow(1024, 3))).toFixed(digits) + 'GB'
  } else {
    return 0 + 'B'
  }
}

/**
 * 格式化传输速度
 * @param speed 传输速度 kb/s
 * @param digits 保留的小数 默认为2位
 */
export function formatSpeed(speed:number, digits:number = 2) {
  if (speed < 1024) {
    return speed + 'Kb/s'
  } else if (speed >= 1024 && speed < Math.pow(1024, 2)) {
    return parseFloat(<string>(speed / 1024)).toFixed(digits) + 'Mb/s'
  } else if (speed >= Math.pow(1024, 2) && speed < Math.pow(1024, 3)) {
    return parseFloat(<string>(speed / Math.pow(1024, 2))).toFixed(digits) + 'Gb/s'
  } else {
    return 0 + 'B'
  }
}
