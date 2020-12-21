const { series } = require('gulp');

function compileSmartContracts(cb) {
  // body omitted
  cb();
}


function startGanacheServer(cb) {
  // body omitted
  cb();
}

function runTests(cb) {
  // body omitted
  cb();
}

if (process.env.NODE_ENV === 'development') {
  exports.build = series(compileSmartContracts, startGanacheServer, runTests);
} else {
}
