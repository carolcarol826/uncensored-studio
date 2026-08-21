# LoRA 实操手册 · 从 v1/v2 学到的

这份文档记录训练 `myhimcock-v1/v2` 过程中**实际踩过的坑和验证过的做法**,
不是通用教程。目的是让下一次训练(尤其是 Qwen)不用重新试错。

---

## 0. 为什么还有下一次:中英文能力不对齐

**现状**:文生图有两条路径,能力不同。

| 路径 | 触发条件 | 基座 | 有解剖 LoRA 吗 |
|---|---|---|---|
| 英文 | 提示词不含中文 | Chroma1-HD | ✅ `myhimcock-v2` |
| 中文 | 提示词含中文字符 | Qwen-Image-Edit + 空白画布 | ❌ **没有** |

**根因**:LoRA 是**针对特定权重的增量**,在 Chroma 上训的挂不到 Qwen 上。

**后果**:中文用户和英文用户同价(1 积分),但中文拿不到解剖形态的改进。
这不是定价问题,是技术边界。

**唯一解**:在 Qwen-Image-Edit 上单独训一个同概念的 LoRA。
数据集可以复用(同一批图),但训练要重来一次。

---

## 1. 数据集:选图标准

标准是站主定的,按重要性排序。**尺寸是硬门槛,其余有容差。**

| 维度 | 要求 | 备注 |
|---|---|---|
| **尺寸** | 够大 | **硬门槛**。角度合格但尺寸小的一律否 |
| **角度** | 上扬约 45 度,**与小腹之间有间隙** | 不能贴死在腹肌上,也不能水平往外顶 |
| **龟头形态** | 正确 | 小缩略图看不出,必须放大判 |
| **睾丸** | 饱满 | 同上 |
| **手部** | 若入镜,五指分明、无粘连 | 见第 3 节的教训 |

### 选图不要由 AI 预筛

v1/v2 全程中,我的判读和站主的标准**系统性不一致**:
我判"朝下"的被选中,我判"合格"的被否掉。预筛只会误伤。

**做法**:生成候选 → 出编号联系表 → **站主全量筛** → 定稿。

### 联系表的两个坑

1. **编号必须唯一**。曾经同时印了"表内序号"和"文件名序号",
   两个数字并排,选择反馈对错了号。现在 `sheet.py` 只印一个。
2. **排序必须按数字**。字母序会把 `10_` 排在 `1_` 前面。
3. **判角度/比例/手部必须看原图**。小网格图会骗人 ——
   这个错误在一晚上犯了三次(体型、畸形、站姿角度),每次都是看原图才纠正。

---

## 2. 数据集:多样性决定了 LoRA 的边界

**LoRA 只在它见过的分布内有效。**

v1 的教训:15 张全是坐姿/跪姿 → 站姿完全学不会,
生成站姿时仍然回到基座的疲软先验。
v2 补了 7 张站姿 → 站姿角度修好。

同理,v1 全是浅肤色,只能靠标注挡住污染;
v2 加了 3 张深肤色,才算真正见过。

**开训前检查分布**:姿势、体型、肤色、光线、场景,
任何一项高度集中,那一项就会被绑进触发词。

---

## 3. 标注:唯一的规则,和它的反噬

### 规则

> **LoRA 学的是「标注没有解释掉的那部分差异」。**

- 标注里**写了**的特征 → 归属给那些词,不绑触发词
- 标注里**没写**的特征 → 全部沉淀进触发词

所以标注要写清**发色、体型、肤色、姿势、房间、光线**,
唯独**不写**要训练的概念(勃起形态、角度、尺寸)。

### 这条规则会反噬

v1 的标注没提"手",而训练集里多张图有手在腹股沟附近、
其中一张的手本身就是糊的。结果:**触发词把"糊掉的手"一起学走了**,
生成时腹股沟处的手经常粘连。

**教训**:凡是画面里存在、又不想被学进触发词的东西,都必须写进标注 ——
不只是"主体特征",连手臂位置、遮挡物、道具都算。

### 具体检查清单

```
□ 触发词在每条标注开头
□ 解剖描述词全部切除(erect / girth / thick / upward / navel / testicle / 45 degrees / gap)
□ 肤色写明(若数据集肤色单一,必须写,否则绑进触发词)
□ 手部若入镜,写明位置(如 "one hand resting on his thigh")
□ 光线特殊的写明(如 "warm golden lighting")
□ 剔除本身有缺陷的图(坏手、畸形),不要指望标注能救
```

### 切除解剖词的正确做法

不要用正则逐词删 —— v1 那样做泄漏了 `tip near his navel` 和 `heavy`,
**标注里出现尺寸词等于告诉模型"尺寸由这些词负责",触发词就学不到了**,
和目标正好相反。

正确做法:提示词是模板生成的,按**固定边界**整段切除。
本项目的模板边界:

```
... nude, {ANATOMY_BLOCK}, anatomically correct male anatomy, ...
... nude, {ANATOMY_BLOCK}, sharp focus, ...
```

切完跑一次泄漏检查(`captions2.py` 里有),命中就报警。

---

## 4. 训练环境:五个坑,每个都真实发生过

用 [ai-toolkit](https://github.com/ostris/ai-toolkit) + RunPod pod。

| # | 症状 | 真因 | 修法 |
|---|---|---|---|
| 1 | 创建 pod 报 500 "no pods with required specifications" | 网络卷所在机房(EU-RO-1)只有部分 GPU 有货 | 逐个 GPU 型号探测。实测**只有 RTX 4090 稳定可用** |
| 2 | SSH 连接被拒,但 pod 状态 RUNNING | 镜像缺 SSH host key,`sshd` 启动即退出 | 启动命令里先 `ssh-keygen -A` |
| 3 | `run.py` 三秒退出,`diffusers` 导入失败 | 镜像自带 torch 2.4.1 太旧,解析不了新版 transformers 的 `X \| None` 类型注解 | 升级 torch,**但必须锁 CUDA 版本** |
| 4 | 升级后 `torch.cuda.is_available()` 为 False | `pip install -U torch` 装了 cu130,而机器驱动是 CUDA 12.8。**不同物理机驱动不同,同一条命令结果不确定** | `pip install --force-reinstall torch --index-url .../cu128`。注意 `-U` **不会降级**,必须 `--force-reinstall` |
| 5 | `numpy.dtype size changed` | scipy 1.12 按 numpy 1.x 编译,环境里是 numpy 2.x | `pip install -U scipy` |
| 6 | 训练写配置文件就报 `Disk quota exceeded` | 网络卷 100GB 配额被模型占满 | `training_folder` 指向 pod 本地盘,训完再拷 LoRA 回卷(只有 112MB) |

### 数据集怎么传上 pod

**不能塞进启动命令** —— RunPod API 的 body 上限实测**小于 256KB**,
3MB 的 base64 直接 500(报 JSON 反序列化失败)。

做法:注册 SSH 公钥 → pod 起 sshd → `scp` 传数据集。

```bash
# 注册公钥(一次性)
mutation { updateUserSettings(input: {pubKey: "ssh-ed25519 ..."}) { id } }
```

### 放行训练前必须手动验三项

**不要让监控替你判断**。v2 第一次就是监控读到网络卷上 v1 留下的
`DEPS_DONE`,在依赖还没装完时就放行了。

```
1) python -c 'import torch; print(torch.cuda.is_available(), torch.cuda.get_device_name(0))'
2) python -c 'from diffusers import AutoencoderTiny; import transformers'
3) ls /workspace/dataset | wc -l   # 应为图片数 × 2
```

---

## 5. 监控:完成标记不是成功的证据

v1 第一次训练在 3 秒内崩溃,而启动脚本无条件执行了
`touch TRAIN_DONE`(因为只写了 `set -x` 没写 `set -e`)。
监控据此判定"训练完成"。**如果只看那个标记,会向用户汇报一个不存在的 LoRA。**

**监控必须看实际产物**,而且至少三个信号交叉验证:

```
- GPU 占用率(训练中应持续 90-100%)
- checkpoint 文件数(应随步数增长)
- 日志里的步数(应单调递增)
- run.py 进程是否还在
```

任何一个对不上就停。另外:

- **日志写 pod 本地路径**,不要用网络卷上跨运行共享的文件(会被上次的残留污染)
- **设硬预算上限**,无人值守时超时无条件销毁 pod
- 步数长时间不涨判定为卡死

---

## 6. 训练配置(已验证)

```yaml
network:  { type: lora, linear: 16, linear_alpha: 16 }
train:
  steps: 1500              # 15-22 张约 68-100 轮,再多容易过拟合
  batch_size: 1
  lr: 1e-4
  optimizer: adamw8bit
  noise_scheduler: flowmatch
  gradient_checkpointing: true
  disable_sampling: true   # 采样耗 GPU 时间,真正的检验是训后 A/B
  ema_config: { use_ema: true, ema_decay: 0.99 }
  dtype: bf16
model:
  name_or_path: "lodestones/Chroma1-HD"   # 必须与推理基座一致
  arch: "chroma"
  quantize: true
save:
  save_every: 250          # 留中间存档,过拟合时可回退
  max_step_saves_to_keep: 6
datasets:
  resolution: [768, 1024]
  caption_dropout_rate: 0.05
```

**基座必须与推理端一致。** 生产用 `Chroma1-HD-fp8mixed`(Comfy-Org 重打包版),
训练用 `lodestones/Chroma1-HD`(原始 bf16)—— 同一模型不同精度,可以。
但如果训练用了"最新版 Chroma"而生产是 Chroma1-HD,LoRA 迁移效果是随机的。

**实测**:RTX 4090,1500 步,22 张图 → **81 分钟**。

---

## 7. 验证:A/B 必须问三个问题

只问"效果变好了吗"会漏掉过拟合。

| # | 问题 | 怎么测 |
|---|---|---|
| 1 | **形态对了吗** | 提示词**只写 `erect penis`**,不写角度尺寸。形态该由 LoRA 承担;还要靠堆词就是没学会 |
| 2 | **真实感退化了吗** | 过拟合最先牺牲真实感。看皮肤是否变得油亮塑料 |
| 3 | **多样性塌缩了吗** | 用**训练集之外**的人物和场景(不同肤色、体型、房间)。如果都被拉回训练集的样子,就是过拟合 |

**同 seed 对照**,base / v1 / v2 三方并排。
判读时**看原图,不看网格缩略图**。

---

## 8. 成本与时间(实测)

| 项 | 数值 |
|---|---|
| RTX 4090 pod | **$0.74/小时** |
| 一次干净的训练(含依赖安装 + 模型下载) | 约 **1.5 小时 ≈ $1.1** |
| v1 实际花费(含排查四个坑) | $1.67 |
| 候选图生成 | 约 $0.05/张 |
| **对比:第三方平台** | fal.ai 等约 **$2/次**,且不支持 Chroma、多数禁露骨内容 |

自训在**成本、基座支持、内容政策、数据不外流**四项上都占优,
除非要训的是非露骨概念且基座是 SDXL/Flux。

---

## 9. 下次训 Qwen 时的差异点

数据集和标注**可以直接复用**,但以下要改:

1. **基座**:`arch` 和 `name_or_path` 换成 Qwen-Image-Edit 对应值,
   需先确认 ai-toolkit 当前版本对它的支持情况
2. **显存**:Qwen 比 Chroma 大(unet 19GB vs 7.7GB),24GB 可能不够,
   要么开更激进的量化,要么租 48GB 卡(注意坑 #1:机房不一定有货)
3. **触发词**:Qwen 图上已经有 NSFW LoRA 用 `nsfw` 触发,
   新 LoRA 要用**不同的触发词**,避免互相干扰
4. **接入点**:`lib/workflows/qwen-zh-t2i.json` 加 `LoraLoaderModelOnly`,
   并在 `app/api/generate/route.ts` 的中文分支补触发词
   (英文分支的写法可以照抄)
5. **叠加验证**:Qwen 图上会同时挂 Lightning LoRA + NSFW LoRA + 新 LoRA,
   **三个叠加必须实测**有没有互相干扰,不能假设能共存

---

## 10. 已知未解决

- **手握姿势**:全身构图下手只有约 80 像素,画不出抓握结构,
  32 张候选只有 1 张可用。正在验证「改中景构图提高手部像素」这个假设
- **中文路径无解剖 LoRA**:见第 0 节
