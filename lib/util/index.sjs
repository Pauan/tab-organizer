var min_int = -9007199254740991;
var max_int =  9007199254740991;

var floor = Math.floor;

exports.rebalanceIndexes = function (array, f) {
  var offset = floor(max_int / (array.length + 1)) * 2;

  if (offset < 1) {
    throw new Error("rebalance: Array is too full! This should never happen!");
  }

  return array.map(function (x, i) {
    return f(x, min_int + ((i + 1) * offset));
  });
};

exports.getIndex = function (array, i, f) {
  var prev = (i === 0
               ? min_int
               : f(array[i - 1]));

  var next = (i < array.length
               ? f(array[i])
               : max_int);

  var diff = floor((next - prev) / 2);

  if (diff < 1) {
    return null;
  } else {
    return prev + diff;
  }
};

/*function insert(array, i) {
  var index = getIndex(array, i);
  if (index === null) {
    array = rebalance(array, function (x, i) {
      x.index = i;
      return x;
    });

    index = getIndex(array, i);
    if (index === null) {
      throw new Error("insert: Array is too full! This should never happen!");
    }
  }

  array.splice(i, 0, {
    index: index
  });
}*/
