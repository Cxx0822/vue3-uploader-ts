<template>
  <div class="app-container">
    <h2>文件传输系统</h2>
    <el-card shadow="always">
      <h3>上传文件模块</h3>
      <upload-file />
    </el-card>
  </div>

<!--  <download-file/>-->
</template>

<script setup lang="ts">
import UploadFile from '@/components/UploadFile.vue'
import DownloadFile from '@/components/DownloadFile.vue'
</script>

<style lang="scss" scoped>
.app-container {
  h3, h2 {
    text-align: center;
  }
}
</style>
