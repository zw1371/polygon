// 1：***本JS默认lat为X轴 lng为Y轴
// 2：***本JS不适应与经纬度交叉区域的绘制，及一个多边形跨域了本初子午线 或者跨域了赤道 或跨域了180度经线

(function(w) {
  /**
   * 判断是否是多边形
   * @name IsPolygon
   * @function
   * @param {Object} pointData 多边形各个点的顺序数组([{lat:31,lng:121},{lat:32,lng:122}])
   * @returns {Boolean} 是否多边形
   */
  var IsPolygon = function(pointData) {
    var pointsList = _unique(pointData);
    if (pointsList.length < 3) {
      return true;
    }
    var len = pointsList.length,
        isPolygon = true,
        line = null,
        otherLineList = [],
        currentLine = null,
        item = null,
        OverlapLineCount = 0,
        prevItem = null,
        nextItem = null;
    if (len < 3) {
      return false;
    }
    for (var i = 0;i < len; i++) {
      item =  pointsList[i];
      prevItem = pointsList[i-1];
      if ( i == len-1) {
        nextItem = pointsList[0];
      }else{
        nextItem = pointsList[i+1];
      }
      currentLine = {
        S:{
          x:item.lat,
          y:item.lng,
        },
        E:{
          x:nextItem.lat,
          y:nextItem.lng,
        }
      }
      otherLineList = getPolygonLine(pointsList, currentLine);
      OverlapLineCount = getOverlapCount(currentLine, otherLineList);
      if (OverlapLineCount.length > 2) {
        isPolygon = false;
        break;
      }
    }
    return isPolygon;
  }

  /**
   * 判断点是否在多边形内部
   * @name isInPolygon
   * @function
   * @param {Object} pointData 多边形各个点的顺序数组([{lat:31,lng:121},{lat:32,lng:122}])
   * @param {Object} point 点坐标 {lat:31,lng:121}
   * @returns {Boolean} 是否在多边形内部
   */
  var IsInPolygon = function(pointData, point) {
    if (pointData.length < 3) {
      return false;
    }
    var isPolygon = IsPolygon(pointData);
    if (isPolygon == false) {
      return false;
    }
    var pointsList = _unique(pointData);
    //矩形排除法-取多边形的XY轴的最大最小值，得到一个矩形，判断点是否在这个矩形内
    var MaxYPoint = getMaxYPoint(pointsList);
    var MinYPoint = getMinYPoint(pointsList);
    var MaxXPoint = getMaxXPoint(pointsList);
    var MinXPoint = getMinXPoint(pointsList);
    var isInRectangle = IsInRectangle(point, MaxYPoint.lng, MinYPoint.lng, MaxXPoint.lat, MinXPoint.lat);
    if (!isInRectangle) {
      return false;
    }
    //边上排除法-如果点在多边形的边上,那就肯定在多边形内部
    var isInPolygonLine = IsInPolygonLine(point, pointData);
    if (isInPolygonLine) {
      return true;
    }
    //获取相交线-把点到Y轴之间的距离作为一条线段，获取这条线段与多边形相交边的个数(如果相交而且斜率一致的排除)
    var focusNum = getHorizontalfocusWithPolygon(point, pointsList);
    if (focusNum%2 ==0) {
      return false;
    }
    return true;
  }

  /**
   * 线段去重
   * @name _unique
   * @function
   * @param {Object} list [{lat:0, lng: 0}, {lat:0, lng: 0}]
   * @returns {Object} 
   */
  var _unique = function(list) {
    var _list = [],
        d = {},
        key = "",
        item = null,
        len = list.length;
    for (var i = 0; i < len; i++) {
      item = list[i];
      key = "" + item.lat + item.lng;
      if (d.hasOwnProperty(key) == false) {
        _list.push(item);
        d[key] = 1;
      }
    }
    return _list;
  }
  
  /**
   * 获取多边形除指定线段的其他线段
   * @name getPolygonLine
   * @function
   * @param {Object} pointsList 多边形各个点的顺序数组
   * @param {Object} line 指定排除的线段
   * @returns {Object} 多边形线段数组
   */
  var getPolygonLine = function(pointsList, expectLine) {
    var len = pointsList.length,
        line = null,
        item = null,
        lineList = [],
        prevItem = null,
        nextItem = null;
    for (var i = 0;i < len; i++) {
      item =  pointsList[i];
      prevItem = pointsList[i-1];
      if ( i == len-1) {
        nextItem = pointsList[0];
      }else{
        nextItem = pointsList[i+1];
      }
      if (parseFloat(item.lat) == parseFloat(expectLine.S.x) && parseFloat(item.lng) == parseFloat(expectLine.S.y)) {
        continue;
      }
      line = {
        S:{
          x:item.lat,
          y:item.lng,
        },
        E:{
          x:nextItem.lat,
          y:nextItem.lng,
        }
      }
      lineList.push(line);
    }
    return lineList;
  }
  
  /**
   * 获取指定线段与线段数组里面相交的线段(不包括斜率一致的)
   * @name getOverlapCount
   * @function
   * @param {Object} line 指定线段
   * @param {Object} lineList 线段数组
   * @returns {Object} 返回相交的线段
   */
  var getOverlapCount = function(line, lineList) {
    var len = lineList.length,
        item = null,
        OverlapLine = [];
    for (var i = 0; i < len; i++) {
      item = lineList[i];
      if (isOverlapping(line, item) && isEqualK(line, item) == false) {
        OverlapLine.push(item);
      }
    }
    return OverlapLine;
  }
  
  /**
   * 获取点与Y轴之间构成的线段 与多边形相交的边的个数(如果相交而且斜率一致的排除)
   * @name getHorizontalFocalPointWithPolygon
   * @function
   * @param {Object} point 点
   * @param {Object} polygonPoints 多边形点集合
   * @returns {Object} 相交的边的个数
   */
  var getHorizontalfocusWithPolygon = function(point, polygonPoints) {
    var focusNum = 0,
        len = polygonPoints.length,
        horizontalPointLine = {
          S:{
            x:0,
            y:point.lng
          },
          E:{
            x:point.lat,
            y:point.lng
          }
        },
        line = null,
        item = null,
        lineSP = null,
        lineEP = null;
    for (var i = 0; i < len; i++) {
      item = polygonPoints[i];
      lineSP = {
        x:item.lat,
        y:item.lng
      }
      if (i == len - 1) {
        lineEP = {
          x:polygonPoints[0].lat,
          y:polygonPoints[0].lng
        }
      }else{
        lineEP = {
          x:polygonPoints[i+1].lat,
          y:polygonPoints[i+1].lng
        }
      }
      line = {
        S:lineSP,
        E:lineEP
      }
      if (isOverlapping(horizontalPointLine,line) && !isEqualK(horizontalPointLine,line)) {
        focusNum++;
      }
    }
    return focusNum;
  }
  
  /**
   * 判断点是否在多边形的边上
   * @name IsInPolygonLine
   * @function
   * @param {Object} point 点
   * @param {Object} polygonPoints 多边形点集合
   * @returns {Boolean} 是否在边上
   */
  var IsInPolygonLine = function(point, polygonPoints) {
    var isInLine = false,
        len = polygonPoints.length,
        P = {
          x:point.lat,
          y:point.lng,
        },
        item = null,
        nextItem = null,
        lineSP = null,
        lineEP = null;
    for (var i = 0; i < len; i++) {
      item = polygonPoints[i];
      nextItem = polygonPoints[i+1];
      lineSP = {
        x:item.lat,
        y:item.lng
      }
      if (i = len - 1) {
        lineEP = {
          x:nextItem.lat,
          y:nextItem.lng
        }
      }else{
        lineEP = {
          x:polygonPoints[0].lat,
          y:polygonPoints[0].lng
        }
      }
      if (isPointInLine(P,lineSP,lineEP) == 0) {
        isInLine = true;
        break;
      }
    }
    return isInLine;
  }
  
  /**
   * 判断点是否在指定矩形内
   * @name IsInRectangle
   * @function
   * @param {Object} point 点
   * @param {Object} MaxYPoint 矩形Y轴的最大值
   * @param {Object} MinYPoint 矩形Y轴的最小值
   * @param {Object} MaxXPoint 矩形X轴的最大值
   * @param {Object} MinXPoint 矩形X轴的最小值
   * @returns {Boolean} 是否在矩形内部
   */
  var IsInRectangle = function(point, MaxYPoint, MinYPoint, MaxXPoint, MinXPoint) {
    if (point.lat >= MinXPoint && point.lat <= MaxXPoint && point.lng >= MinYPoint && point.lng <= MaxYPoint) {
      return true;
    }
    return false;
  }
  
  /**
   * 获取所有点中Y轴最高的点
   * @name getMaxYPoint
   * @function
   * @param {Object} points 点的集合
   * @returns {Object} 返回Y轴最高的点
   */
  var getMaxYPoint = function(points) {
    var len = points.length,
        item = null,
        YPoint = {
          lat:-Infinity,
          lng:-Infinity
        }
    for (var i = 0; i < len; i++) {
      item = points[i];
      if (parseFloat(item.lng) > parseFloat(YPoint.lng)) {
        YPoint = item;
      }
    }
    return YPoint;
  }
  
  /**
   * 获取所有点中Y轴最低的点
   * @name getMinYPoint
   * @function
   * @param {Object} points 点的集合
   * @returns {Object} 返回Y轴最低的点
   */
  var getMinYPoint = function(points) {
    var len = points.length,
        item = null,
        YPoint = {
          lat:Infinity,
          lng:Infinity
        }
    for (var i = 0; i < len; i++) {
      item = points[i];
      if (parseFloat(item.lng) < parseFloat(YPoint.lng)) {
        YPoint = item;
      }
    }
    return YPoint;
  }
  
  /**
   * 获取所有点中X轴最高的点
   * @name getMaxXPoint
   * @function
   * @param {Object} points 点的集合
   * @returns {Object} 返回X轴最高的点
   */
  var getMaxXPoint = function(points) {
    var len = points.length,
        item = null,
        YPoint = {
          lat:-Infinity,
          lng:-Infinity
        }
    for (var i = 0; i < len; i++) {
      item = points[i];
      if (parseFloat(item.lat) > parseFloat(YPoint.lat)) {
        YPoint = item;
      }
    }
    return YPoint;
  }
  
  /**
   * 获取所有点中X轴最低的点
   * @name getMinXPoint
   * @function
   * @param {Object} points 点的集合
   * @returns {Object} 返回X轴最低的点
   */
  var getMinXPoint = function(points) {
    var len = points.length,
        item = null,
        YPoint = {
          lat:Infinity,
          lng:Infinity
        }
    for (var i = 0; i < len; i++) {
      item = points[i];
      if (parseFloat(item.lat) < parseFloat(YPoint.lat)) {
        YPoint = item;
      }
    }
    return YPoint;
  }
  
  /**
   * 判断斜率是否一致
   * @name isEqualK
   * @function
   * @param {Object} lineA 线段A
   * @param {Object} lineB 线段B
   * @returns {Boolean} 返回斜率是否一致
   */
  var isEqualK = function(lineA, lineB) {
    var lineAK = _getLineK(lineA.S.x, lineA.S.y, lineA.E.x, lineA.E.y);
    var lineBK = _getLineK(lineB.S.x, lineB.S.y, lineB.E.x, lineB.E.y);
    return lineAK == lineBK;
  }
  
  /**
   * 判断两个线段是否相交
   * @name isOverlapping
   * @function
   * @param {Object} lineA 线段A
   * @param {Object} lineB 线段B
   * @returns {Boolean} 返回是否交叉
   */
  var isOverlapping = function(lineA, lineB) {
    var lineAStartPointInLineB = isPointInLine(lineA.S, lineB.S, lineB.E);
    var lineAEndPointInLineB = isPointInLine(lineA.E ,lineB.S, lineB.E);
    var lineBStartPointInLineA = isPointInLine(lineB.S, lineA.S, lineA.E);
    var lineBEndPointInLineA = isPointInLine(lineB.E, lineA.S, lineA.E);
    //只要有一点在另外一条线上我们就认为相交,也就是两条直线相交
    if (lineAStartPointInLineB == 0 || lineAEndPointInLineB == 0 || lineBStartPointInLineA == 0 || lineBEndPointInLineA == 0 ) {
      return true;
    }
    //如果上面条件不满足,点都不在对应的线段上,但是有一个点在另外一条线的延长线上,说明一定不会相交
    if (lineAStartPointInLineB == -2 || lineAEndPointInLineB == -2 || lineBStartPointInLineA == -2 || lineBEndPointInLineA == -2 ) {
      return false;
    }
    //因为在上面是1,在下面是-1,两个相乘如果小于0则一定在两边,如果两条线段的两个端点分别在对应线段的两端,说明相交
    if (lineAStartPointInLineB*lineAEndPointInLineB < 1 && lineBStartPointInLineA*lineBEndPointInLineA < 1) {
      return true;
    }
    return false;//默认不相交
  }
  
  /**
   * 判断点point是否在以linePS为起点,linePE为终点的线段上
   * @name isPointInLine
   * @function
   * @param {Object} point 点
   * @param {Object} linePS 线段A
   * @param {Object} linePE 线段B
   * @returns {Number} 0：在线段上. 1：不在线段上，而是在线段的上方. -1：不在线段上，而是在线段的下方. -2:不在线段上，而是在线段所在的直线上
   */
  var isPointInLine = function(point, linePS, linePE) {
    var maxLineX = 0,
        minLineX = 0,
        maxLineY = 0,
        minLineY = 0,
        K = _getLineK(linePS.x, linePS.y, linePE.x, linePE.y);
    var B = _getLineB(linePS.x, linePS.y, K);
    var linePointY = (K * point.x + B);
    if (linePS.x < linePE.x) {
      maxLineX = linePE.x; minLineX = linePS.x;
    }else{
      maxLineX = linePS.x; minLineX = linePE.x;
    }
    if (linePS.y < linePE.y) {
      maxLineY = linePE.y; minLineY = linePS.y;
    }else{
      maxLineY = linePS.y; minLineY = linePE.y;
    }
    if (point.x >= minLineX && point.x <= maxLineX && point.y >= minLineY && point.y <= maxLineY) {//在线段所在的矩形范围之内
      if (linePointY == point.y) {
        return 0;
      }else if (linePointY > point.y) {
        if (point.y >= 0) {
          return -1
        }else {
          return 1
        }
      }else{
        if (point.y >= 0) {
          return 1
        }else {
          return -1
        }
      }
    }else{
      if (linePointY == point.y) {
        return -2;
      }else if (linePointY > point.y) {
        if (point.y >= 0) {
          return -1
        }else{
          return 1
        }
      }else{
        if (point.y >= 0) {
          return 1
        }else{
          return -1
        }
      }
    }
  }
  
  /**
   * 获取线段的斜率
   * @name _getLineK
   * @function
   * @param {Object} x1 X坐标1
   * @param {Object} y1 Y坐标1
   * @param {Object} x2 X坐标2
   * @param {Object} y2 Y坐标2
   * @returns {Number} 斜率
   */
  var _getLineK = function(x1, y1, x2, y2) {
    return (y1 - y2) / (x1 - x2);
  }

  /**
   * 获取线段的y轴截距
   * @name _getLineB
   * @function
   * @param {Object} x1 X坐标1
   * @param {Object} y1 Y坐标1
   * @param {Object} k  斜率
   * @returns {Number} 线段的y轴截距
   */
  var _getLineB = function(x1, y1, k) {
    return y1 - k * x1;
  }

  w.IsPolygon = IsPolygon;
  w.IsInPolygon = IsInPolygon;
})(window);
