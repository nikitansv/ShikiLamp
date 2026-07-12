const cache = require('../src/cache');
const storage = require('../src/mapping/storage');

function createTestStorage() {
  let data = {};
  return {
    get: function (key, defaultValue) {
      return data.hasOwnProperty(key) ? data[key] : defaultValue;
    },
    set: function (key, value) {
      data[key] = value;
    },
    clear: function () { data = {}; }
  };
}

beforeEach(() => {
  const store = createTestStorage();
  cache.setTestStore(store);
  storage.setTestStore(store);
});

afterAll(() => {
  cache.setTestStore(null);
  storage.setTestStore(null);
});
