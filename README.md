# 数学实验室 · MathLab

单文件、零构建依赖的 3Blue1Brown 风格数学可视化工作台。主题通过模块契约注册，core 不含任何主题专属代码。

## 使用

- **开发版**：直接双击 `src/index.html`（Chrome / Edge 支持从 `file://` 加载同目录经典脚本；Firefox 建议用构建产物）。
- **单文件版**：`node tools/build.mjs` 生成 `dist/mathlab.html`，双击即用，可离线分发。
- 断网时：GSAP 缺失自动切换内置补间器，KaTeX 缺失切换文本排版，功能不残。

## 已内置主题

| 主题 | 内容 |
| --- | --- |
| 空间直角坐标系 | 3D 向量加法/内积投影/叉积/平行六面体；直角/柱/球三种坐标制式；拖动箭头端点（Shift = 相机平面全自由度）；双击地面放自由点 |
| 微积分 | 自写表达式解析器输入 f(x)/g(x)；割线→切线极限（h→0）；中心差分求导；五种黎曼和方法；误差随 N 的 log-log 收敛图；自动滚动切点 |
| 数论 · 模运算 | 素数螺旋（Ulam）、模乘表（乘法群/单位）、Collatz 对数瀑布（安全整数溢出保护） |

## 快捷键

- `空格` 播放/暂停 · `←/→` 逐帧 · 拖时间轴 scrub
- 滚轮 缩放 · 拖动 旋转视角/设置切点 · `Alt+拖动` 平移 · 3D 中 `Shift+拖动端点` 全自由度
- `?` 帮助提示

## URL 参数

- `?selftest=1` 内核自检（表达式解析器、4×4 矩阵、3D 投影往返、数值微积分、筛法与 Collatz）
- `?stats=1` 帧时间/图元统计
- `#t=<topic>&s=<压缩状态>` 状态分享：面板「复制链接」生成，直接打开即可复现

## 添加一个新主题

1. 新建 `src/topics/<name>.js`，`LAB.topics.<name> = { meta, impl }`，其中 meta 声明 `defaults/schema/timeline`，impl 实现 `init/onParam/onMode/onToggle/onField/onPointer/onKey/applyTime/render/serialize/deserialize/selftest`（全部可选）。
2. 在 `src/index.html` 的脚本区加一行 `<script src="topics/<name>.js"></script>`。
3. 重新构建。core 无需改动。

## 结构

```
src/
  index.html            开发壳（样式、布局、脚本装配）
  core/                 框架（boot/util/tween/vec/expr/state/viewport/render/ui/shortcuts/hud/app）
  topics/               主题模块（coordinate3d / calculus / numbertheory）
  main.js               装配终点（置位 app.ready）
tools/build.mjs         拼接 → dist/mathlab.html
```

安全说明：表达式输入不使用 `eval` / `new Function`，纯递归下降解释执行；词法层只放行数字、标识符与有限运算符，注入样例在 `?selftest=1` 中被断言拒绝。
