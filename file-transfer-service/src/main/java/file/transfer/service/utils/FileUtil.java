package file.transfer.service.utils;

import file.transfer.service.entity.upload.ChunkInfo;
import lombok.extern.slf4j.Slf4j;

import java.io.*;
import java.nio.file.*;
import java.util.Objects;

/**
 * @author Cxx
 */
@Slf4j
public class FileUtil {
    private static final String FILE_SEPARATOR = "_";

    /**
     * 获取文件路径
     *
     * @param uploadFolder 上传文件夹路径
     * @param chunkInfo    分片文件信息
     * @return 文件路径
     */
    public static String generatePath(String uploadFolder, ChunkInfo chunkInfo) {
        String filePath = uploadFolder + File.separator + chunkInfo.getIdentifier();
        Path path = Paths.get(filePath);
        // 判断uploadFolder/identifier 路径是否存在，不存在则创建
        if (!Files.isWritable(path)) {
            log.info("文件路径不存在 创建路径: {}", filePath);
            try {
                Files.createDirectories(path);
            } catch (IOException exception) {
                log.error("创建路径失败: " + exception.getMessage());
            }
        }

        return filePath + File.separator + chunkInfo.getFilename() + FILE_SEPARATOR + chunkInfo.getChunkNumber();
    }

    /**
     * 根据文件的全路径名判断文件是否存在
     */
    public static boolean fileExists(String file) {
        Path path = Paths.get(file);
        return Files.exists(path, LinkOption.NOFOLLOW_LINKS);
    }

    /**
     * 删除目录（文件夹）以及目录下的文件
     *
     * @param sPath 被删除目录的文件路径
     * @return 目录删除成功返回true，否则返回false
     */
    public static boolean deleteDirectory(String sPath) {
        // 如果sPath不以文件分隔符结尾，自动添加文件分隔符
        if (!sPath.endsWith(File.separator)) {
            sPath = sPath + File.separator;
        }
        File dirFile = new File(sPath);
        // 如果dir对应的文件不存在，或者不是一个目录，则退出
        if (!dirFile.exists() || !dirFile.isDirectory()) {
            return false;
        }

        boolean flag = true;
        // 删除文件夹下的所有文件(包括子目录)
        File[] files = dirFile.listFiles();
        for (File file : Objects.requireNonNull(files)) {
            // 删除子文件
            if (file.isFile()) {
                flag = deleteFile(file.getAbsolutePath());
            }
            // 删除子目录
            else {
                flag = deleteDirectory(file.getAbsolutePath());
            }
            if (!flag) {
                break;
            }
        }
        if (!flag) {
            return false;
        }

        log.info("文件删除成功");
        // 删除当前目录
        return dirFile.delete();
    }

    /**
     * 删除单个文件
     *
     * @param sPath 被删除文件的文件名
     * @return 单个文件删除成功返回true，否则返回false
     */
    public static boolean deleteFile(String sPath) {
        boolean flag = false;
        File file = new File(sPath);
        // 路径为文件且不为空则进行删除
        if (file.isFile() && file.exists()) {
            flag = file.delete();
        }
        return flag;
    }
}
