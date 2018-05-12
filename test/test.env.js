const expect = chai.expect

// console.log(chai, expect)
describe('wombat patching global env', function () {
  it('should put _WBWombat on window', function () {
    expect(window._WBWombat).to.not.be.undefined
  })
})