// don't capture console
const console = require('console');

jest.setTimeout(30 * 60 * 1000);

console.log('declare variable...')
beforeAll(() => console.log('1 - beforeAll'));
afterAll(() => console.log('1 - afterAll'));
beforeEach(() => console.log('1 - beforeEach'));
afterEach(() => console.log('1 - afterEach'));
test('', () => console.log('1 - test1'));
test('', () => console.log('1 - test2'));
describe('Scoped / Nested block', () => {
    console.log('declare variable...')
    beforeAll(() => console.log('2 - beforeAll'));
    afterAll(() => console.log('2 - afterAll'));
    beforeEach(() => console.log('2 - beforeEach'));
    afterEach(() => console.log('2 - afterEach'));
    test('', () => console.log('2 - test1'));
    test('', () => console.log('2 - test2'));
});
describe('Scoped / Nested block', () => {
    console.log('declare variable...')
    beforeAll(() => console.log('2 - beforeAll'));
    afterAll(() => console.log('2 - afterAll'));
    beforeEach(() => console.log('2 - beforeEach'));
    afterEach(() => console.log('2 - afterEach'));
    test('', () => console.log('2 - test1'));
    test('', () => console.log('2 - test2'));
});