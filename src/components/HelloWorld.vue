<template>
  <label class="uploader-btn" ref="btn">
    选择文件
  </label>
</template>

<script setup lang="ts">
import { Uploader } from '../common/uploader'
import { onMounted, ref } from 'vue'
import { UploaderUserOptionsIF } from '../types'

const btn = ref()

const options:UploaderUserOptionsIF = {
  chunkSize: 1 * 1024 * 1024,
  target: 'http://127.0.0.1:8080/fileUpload/chunk',
  fileParameterName: 'multipartFile',
}

let uploader:Uploader

onMounted(() => {
  uploader = new Uploader(options)

  uploader.assignBrowse(btn.value, false, false)

  uploader.on('onFileSuccess', onFileSuccess)
})

const onFileSuccess = (...arg:any[]) => {
  console.log(arg[0])
}

</script>

<style scoped>
</style>
