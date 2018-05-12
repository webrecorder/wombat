/* eslint-env mocha */

const expect = chai.expect
// console.log(chai, expect)
describe('wombat patching global env', function () {
  before(async function () {
    this.wombatSandbox = await window.wombatTestUtil.addWombatSandbox()
  })
  context('before initialization', function () {
    console.log('before')
    it('should put _WBWombat on window', function () {
      console.log('before 1')
      expect(this.wombatSandbox._WBWombat).to.be.a('function')
    })
    it('should not monkey patch prototypes', function () {
      console.log('before 2')
      expect(this.wombatSandbox._WBWombat).to.be.a('function')
    })
  })
  context('after initialization', function () {
    console.log('after')
    it('should not have removed _WBWombat from window', function () {
      expect(this.wombatSandbox._WBWombat).to.be.a('function')
    })
    it('should have added WombatLocation to window', function () {
      console.log('after 2')
      expect(this.wombatSandbox._WBWombat).to.be.a('function')
    })
  })
})
