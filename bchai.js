import chai from 'chai'
import chaiAsPromised from 'chai-as-promised'
import chaiDom from 'chai-dom'

chai.use(chaiAsPromised)
chai.use(chaiDom)
window.chai = chai
