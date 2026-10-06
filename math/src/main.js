/* MathLab · 装配终点
   最后一个加载的脚本：置位 app.ready，触发 boot 里的启动流程。 */
(function () {
  'use strict';
  var LAB = window.LAB = window.LAB || {};
  if (LAB.app && LAB.app.markReady) LAB.app.markReady();
})();
