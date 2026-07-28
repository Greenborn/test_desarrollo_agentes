export class BtnConfig {
  constructor(cfg) {
    this.key = cfg.key || crypto.randomUUID()
    this.icon = cfg.icon || ''
    this.severity = cfg.severity || 'btn-outline-primary'
    this.class = cfg.class || ''
    this.label = cfg.label || ''
    this._getLabel = cfg.getLabel || (() => this.label)
    this._isVisible = cfg.isVisible || (() => true)
    this._isDisabled = cfg.isDisabled || (() => false)
    this.onClick = cfg.onClick || (() => {})
    this.helpKey = cfg.helpKey || null
    this.permissions = cfg.permissions || null
  }
  getLabel() { return this._getLabel() }
  isVisible() { return this._isVisible() }
  isDisabled() { return this._isDisabled() }
}
