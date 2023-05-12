package file.transfer.service.entity.upload;

import lombok.Data;

import java.util.ArrayList;

@Data
public class ChunkResult {
    //是否跳过上传（已上传的可以直接跳过，达到秒传的效果）
    private boolean skipUpload;

    //已经上传的文件块编号，可以跳过，断点续传
    private ArrayList<Integer> uploadedChunks;

    //返回结果码
    private String status;

    //返回结果信息
    private String message;

    //已上传完整附件的地址
    private String location;
}