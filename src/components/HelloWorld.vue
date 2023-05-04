<template>
  <label class="uploader-btn" ref="btn">
    选择文件
  </label>
</template>

<script setup lang="ts">
import { Uploader } from '../common/uploader'
import { onMounted, ref } from 'vue'
import { UploaderOptionsIF } from '../types'

const btn = ref()

const options:UploaderOptionsIF = {
  chunkSize: 1 * 1024 * 1024,
}
onMounted(() => {
  const uploader = new Uploader(options)

  uploader.assignBrowse(btn.value, false, false)
})

</script>

<style scoped>
</style>
