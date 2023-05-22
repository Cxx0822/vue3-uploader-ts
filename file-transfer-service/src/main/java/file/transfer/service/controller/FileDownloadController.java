package file.transfer.service.controller;

import file.transfer.service.result.R;
import file.transfer.service.service.ChunkService;
import file.transfer.service.utils.UploadFileUtil;
import io.swagger.annotations.ApiOperation;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;

import javax.servlet.ServletOutputStream;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;
import java.io.*;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.Optional;

@RestController
@RequestMapping("/fileDownload")
@Slf4j
public class FileDownloadController {
    @Autowired
    private ChunkService chunkService;

    @ApiOperation("获取下载文件信息")
    @GetMapping("/getFileInfo")
    public R getDownloadFileInfo(@RequestParam("downloadFolderPath") String downloadFolderPath,
                                 @RequestParam("fileName") String fileName) {

        String downloadFilePath = downloadFolderPath + File.separator + fileName;
        File downloadFile = new File(downloadFilePath);

        // 判断文件夹是否存在
        if (UploadFileUtil.fileExists(downloadFilePath)) {
            return R.ok().data("fileLength", downloadFile.length());
        } else {
            return R.error().message("download file is not exist");
        }
    }

    @ApiOperation("下载文件块")
    @GetMapping("/chunk")
    public void downloadChunk2(@RequestParam String downloadFolderPath,
                               @RequestParam String fileName,
                               @RequestParam Integer chunkSize,
                               @RequestParam Integer chunkIndex,
                               HttpServletResponse response) {
        String downloadFilePath = downloadFolderPath + File.separator + fileName;

        // 判断文件夹是否存在
        if (UploadFileUtil.fileExists(downloadFilePath)) {
            // 获取需要下载的文件块
            long offset = (long) chunkSize * (chunkIndex - 1);
            byte[] chunk = chunkService.getDownloadChunk(downloadFilePath, chunkSize, offset);
            log.info("download the {}th chunk", chunkIndex);

            // return R.ok().data("chunk", chunk);
            //  清空response
            // response.reset();

            //Content-Disposition的作用：告知浏览器以何种方式显示响应返回的文件，用浏览器打开还是以附件的形式下载到本地保存表示以附件方式下载
            response.addHeader("Content-Disposition", "attachment;filename=" +
                    URLEncoder.encode(fileName, StandardCharsets.UTF_8));
            response.addHeader("Content-Length", "" + (chunk.length));
            response.setHeader("filename", fileName);
            // response.addHeader("Access-Control-Allow-Origin", "*");
            response.setContentType("application/octet-stream");
            ServletOutputStream out = null;
            try {
                out = response.getOutputStream();
                out.write(chunk);
                out.flush();
                out.close();
            } catch (IOException e) {
                e.printStackTrace();
            }
        } else {
            log.error("download file is not exist");
        }
    }


    private final static String utf8 = "utf-8";

    @ApiOperation("下载文件块")
    @GetMapping("/down")
    public void downLoadFile(@RequestParam String downloadFolderPath,
                             @RequestParam String fileName,
                             HttpServletRequest request,
                             HttpServletResponse response) throws IOException {

        // 获取文件路径
        String downloadFilePath = downloadFolderPath + File.separator + fileName;
        File file = new File(downloadFilePath);
        if (!file.exists()) {
            log.error("File is not exist");
            return;
        }

        InputStream inputStream = null;
        OutputStream outputStream = null;
        try {
            // 分片下载
            long fileSize = file.length();
            // 定义断点
            long startPosition, endPosition, sum = 0;

            response.setContentType("application/x-download");
            response.addHeader("Content-Disposition", "attachment;filename=" + fileName);
            //根据前端传来的Range  判断支不支持分片下载
            response.setHeader("Accept-Range", "bytes");

            response.setStatus(HttpServletResponse.SC_PARTIAL_CONTENT);
            // 获取前端的文件块范围
            String chunkRange = request.getHeader("Range");
            String[] chunkRangeArray = chunkRange.split("-");

            // 获取文件块的起始位置
            startPosition = Long.parseLong(chunkRangeArray[0]);
            endPosition = Long.parseLong(chunkRangeArray[1]);
            // 若结束字节超出文件大小 取文件大小
            if (endPosition > fileSize - 1) {
                endPosition = fileSize - 1;
            }

            long rangeLength = endPosition - startPosition + 1;

            outputStream = new BufferedOutputStream(response.getOutputStream());
            inputStream = new BufferedInputStream(new FileInputStream(file));
            // 跳过之前下载的位置
            long skip = inputStream.skip(startPosition);
            // 循环读取文件并写入到response中
            byte[] buffer = new byte[1024];
            int length = 0;
            while (sum < rangeLength) {
                int len = (rangeLength - sum) <= buffer.length ? (int) (rangeLength - sum) : buffer.length;
                length = inputStream.read(buffer, 0, len);
                sum = sum + length;
                outputStream.write(buffer, 0, length);
            }
        } finally {
            if (inputStream != null) {
                inputStream.close();
            }
            if (outputStream != null) {
                outputStream.close();
            }
        }
    }
}
