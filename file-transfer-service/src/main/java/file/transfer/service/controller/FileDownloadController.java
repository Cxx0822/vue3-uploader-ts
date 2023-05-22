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
        // 设置编码格式
        response.setCharacterEncoding(utf8);
        //获取文件路径
        //参数校验

        log.info(fileName, downloadFolderPath);
        //完整路径(路径拼接待优化-前端传输优化-后端从新格式化  )
        String pathAll = downloadFolderPath + File.separator + fileName;
        log.info("pathAll{}", pathAll);
        Optional<String> pathFlag = Optional.of(pathAll);
        File file = null;
        //根据文件名，读取file流
        file = new File(pathAll);
        log.info("文件路径是{}", pathAll);
        if (!file.exists()) {
            log.warn("文件不存在");
            return;
        }

        InputStream is = null;
        OutputStream os = null;
        try {
            //分片下载
            long fSize = file.length();//获取长度
            response.setContentType("application/x-download");
            String file_Name = URLEncoder.encode(file.getName(), StandardCharsets.UTF_8);
            response.addHeader("Content-Disposition", "attachment;filename=" + fileName);
            //根据前端传来的Range  判断支不支持分片下载
            response.setHeader("Accept-Range", "bytes");
            //获取文件大小
            //response.setHeader("fSize",String.valueOf(fSize));
            // response.setHeader("Access-Control-Expose-Headers", "filename");
            // log.info("filename:" + file_Name);
            // response.setHeader("filename", file_Name);
            //定义断点
            long pos = 0, last = fSize - 1, sum = 0;
            //判断前端需不需要分片下载
            if (null != request.getHeader("Range")) {
                response.setStatus(HttpServletResponse.SC_PARTIAL_CONTENT);
                String numRange = request.getHeader("Range").replaceAll("bytes=", "");
                String[] strRange = numRange.split("-");

                if (strRange.length == 2) {
                    pos = Long.parseLong(strRange[0].trim());
                    last = Long.parseLong(strRange[1].trim());
                    //若结束字节超出文件大小 取文件大小
                    if (last > fSize - 1) {
                        last = fSize - 1;
                    }
                } else {
                    //若只给一个长度  开始位置一直到结束
                    pos = Long.parseLong(numRange.replaceAll("-", "").trim());
                }
            }

            long rangeLenght = last - pos + 1;
            String contentRange = "bytes" + pos + "-" + last + "/" + fSize;
            log.info(contentRange);
            response.setHeader("Access-Control-Expose-Headers", "Content-Range");
            response.setHeader("Content-Range", contentRange);

            os = new BufferedOutputStream(response.getOutputStream());
            is = new BufferedInputStream(new FileInputStream(file));
            is.skip(pos);//跳过已读的文件(重点，跳过之前已经读过的文件)
            byte[] buffer = new byte[1024];
            int lenght = 0;
            //相等证明读完
            while (sum < rangeLenght) {
                lenght = is.read(buffer, 0, (rangeLenght - sum) <= buffer.length ? (int) (rangeLenght - sum) : buffer.length);
                sum = sum + lenght;
                os.write(buffer, 0, lenght);
            }
            log.info("下载完成");
        } finally {
            if (is != null) {
                is.close();
            }
            if (os != null) {
                os.close();
            }
        }
    }
}
