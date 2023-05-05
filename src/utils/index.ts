/**
 *
 @param {number} millisecond 传入的需要转换的并且时间单位为毫秒的值
 @param {number} [secondPrecision=0] 保留的秒数的精度
 @param {boolean} [roundSecond=false] 是否对秒数进行四舍五入
 @returns {string} 返回的格式化后的时间字符串
 */
export const formatMillisecond = (
  millisecond: number,
  secondPrecision = 0,
  roundSecond = false
) => {
  const secondDuration = millisecond / 1000
  const hours = Math.floor(secondDuration / 3600)
  const minutes = Math.floor((secondDuration - hours * 3600) / 60)
  let seconds = secondDuration - hours * 3600 - minutes * 60

  if (roundSecond) {
    seconds = Math.round(seconds)
  }

  let secondsStr = seconds.toFixed(secondPrecision)
  if (Number.parseInt(secondsStr) <= 9) {
    secondsStr = `0${secondsStr}`
  }
  return `${hours}:${minutes}:${secondsStr}`
}
