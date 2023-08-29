package file.transfer.service.result;

import io.swagger.annotations.ApiModel;
import io.swagger.annotations.ApiModelProperty;
import lombok.Data;

import java.util.HashMap;
import java.util.Map;

/**
 * @author Cxx
 */
@Data
@ApiModel(value = "全局统一返回结果")
public class AxiosResult {

    @ApiModelProperty(value = "是否成功")
    private Boolean success;

    @ApiModelProperty(value = "返回码")
    private Integer code;

    @ApiModelProperty(value = "返回消息")
    private String message;

    @ApiModelProperty(value = "返回数据")
    private Map<String, Object> data = new HashMap<String, Object>();

    public AxiosResult(){}

    public static AxiosResult ok(){
        AxiosResult axiosResult = new AxiosResult();
        axiosResult.setSuccess(ResultCodeEnum.SUCCESS.getSuccess());
        axiosResult.setCode(ResultCodeEnum.SUCCESS.getCode());
        axiosResult.setMessage(ResultCodeEnum.SUCCESS.getMessage());
        return axiosResult;
    }

    public static AxiosResult error(){
        AxiosResult axiosResult = new AxiosResult();
        axiosResult.setSuccess(ResultCodeEnum.UNKNOWN_REASON.getSuccess());
        axiosResult.setCode(ResultCodeEnum.UNKNOWN_REASON.getCode());
        axiosResult.setMessage(ResultCodeEnum.UNKNOWN_REASON.getMessage());
        return axiosResult;
    }

    public static AxiosResult setResult(ResultCodeEnum resultCodeEnum){
        AxiosResult axiosResult = new AxiosResult();
        axiosResult.setSuccess(resultCodeEnum.getSuccess());
        axiosResult.setCode(resultCodeEnum.getCode());
        axiosResult.setMessage(resultCodeEnum.getMessage());
        return axiosResult;
    }

    public AxiosResult success(Boolean success){
        this.setSuccess(success);
        return this;
    }

    public AxiosResult message(String message){
        this.setMessage(message);
        return this;
    }

    public AxiosResult code(Integer code){
        this.setCode(code);
        return this;
    }

    public AxiosResult data(String key, Object value){
        this.data.put(key, value);
        return this;
    }

    public AxiosResult data(Map<String, Object> map){
        this.setData(map);
        return this;
    }
}
