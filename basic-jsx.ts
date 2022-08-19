const voidElements = [
  // HTML 4.01 / XHTML 1.0 Strict
  'area',
  'base',
  'br',
  'col',
  'hr',
  'img',
  'input',
  'link',
  'meta',
  'param',
  // HTML 5
  'command',
  'keygen',
  'source',
]

function childToString(item: JSX.Children): string | BasicElement {
  if (Array.isArray(item))
    return item.map(childToString).join('')
  else
    return item as string | BasicElement
}

class BasicElement {
  private isVoid: boolean
  private attributesAsString: string | undefined
  constructor(
    private readonly elementTag: string,
    private readonly attributes: Record<string, unknown> | null,
    private readonly children: JSX.Children
  ) {
    this.isVoid = voidElements.includes(this.elementTag)
  }


  private getAttributes() {
    if (this.attributesAsString === undefined) {
      this.attributesAsString = ''
      if (this.attributes !== null) {
        let classHandled = false
        for (const [name, value] of Object.entries(this.attributes)) {
          if (!classHandled && (name === 'class' || name === 'className')) {
            classHandled = true
            const value1 = value
            const value2 =
              name === 'class'
                ? typeof (this.attributes as Record<string, unknown>).className !== 'undefined'
                  ? (this.attributes as Record<string, unknown>).className
                  : ''
                : typeof (this.attributes as Record<string, unknown>).class !== 'undefined'
                ? (this.attributes as Record<string, unknown>).class
                : ''

            const classes = (Array.isArray(value1) ? value1 : String(value1).split(/ +/g))
              .concat(Array.isArray(value2) ? value2 : String(value2).split(/ +/g))
              .filter(Boolean)

            this.attributesAsString += ` class="${classes.join(' ')}"`
          } else if (classHandled && (name === 'class' || name === 'className')) {
            continue
          }

          if (name.startsWith('aria')) {
            const ariaName = 'aria-' + name.substring(4).toLowerCase()
            if (typeof value === 'boolean') {
              if (value) this.attributesAsString += ` ${ariaName}`
            } else if (Array.isArray(value)) {
              this.attributesAsString += ` ${ariaName}="${value.join(' ')}"`
            } else if (typeof value === 'string') {
              this.attributesAsString += ` ${ariaName}="${value}"`
            } else if (typeof value === 'number') {
              this.attributesAsString += ` ${ariaName}="${value}"`
            }
            continue
          }

          if (typeof value === 'boolean') {
            if (value) this.attributesAsString += ` ${name}`
          } else if (Array.isArray(value)) {
            this.attributesAsString += ` ${name}="${value.join(' ')}"`
          } else if (typeof value === 'string') {
            this.attributesAsString += ` ${name}="${value}"`
          } else if (typeof value === 'number') {
            this.attributesAsString += ` ${name}="${value}"`
          }
        }
      }
    }
    return this.attributesAsString
  }

  toString() {
    if (this.isVoid) {
      return `<${this.elementTag}${this.getAttributes()}>`
    } else {
      return `<${this.elementTag}${this.getAttributes()}>${childToString(this.children)}</${this.elementTag}>`
    }
  }
}
class FragmentElement {
  constructor(private readonly elements: JSX.Children) {}

  toString() {
    return childToString(this.elements)
  }
}
class Component<Props = { [name: string]: Record<string, unknown> }> {
  constructor(public props: Props) {}
  render(): BasicElement | BasicElement[] {
    throw new Error('not implemented')
  }
}

/**@namespace */
const React = {
  createElement(
    element: string | ((...args: Record<string, unknown>[]) => BasicElement | BasicElement[]) | (new (...args: Record<string, unknown>[]) => Record<string, unknown>) | undefined,
    properties: Record<string, unknown>,
    ...children: string[]
  ) {
    if (typeof element === 'function') {
      const props = Object.assign({ children }, Object((element as unknown as Record<string, unknown>).defaultProps), Object(properties))
      let result: BasicElement | BasicElement[]
      try {
        result = (element as (...args: Record<string, unknown>[]) => BasicElement | BasicElement[])(props)
      } catch (e) {
        if (e instanceof TypeError && e.message.includes('Class constructor')) {
          result = (new (element as new (...args: Record<string,unknown>[]) => Record<string,unknown>)(Object(properties)) as unknown as Component).render()
        } else {
          throw e
        }
      }
      if (Array.isArray(result)) return new FragmentElement(result)
      return result
    }
    if (element === undefined) return new FragmentElement(children)
    return new BasicElement(element, properties, children)
  },
  Component
}

export default React

//#region Typings

type Alignment = 'left' | 'center' | 'right' | 'justify' | 'char'
type AutoCapitalize = boolean | 'on' | 'off' | 'sentences' | 'words' | 'characters'
type AutoComplete =
  | boolean
  | 'off'
  | 'on'
  | 'name'
  | 'honorific-prefix'
  | 'given-name'
  | 'additional-name'
  | 'family-name'
  | 'honorific-siffux'
  | 'nickname'
  | 'email'
  | 'username'
  | 'new-password'
  | 'current-password'
  | 'one-time-code'
  | 'organization-title'
  | 'organization'
  | 'street-address'
  | 'address-line1'
  | 'address-line2'
  | 'address-line3'
  | 'address-level4'
  | 'address-level3'
  | 'address-level2'
  | 'address-level1'
  | 'country'
  | 'country-name'
  | 'postal-code'
  | 'cc-name'
  | 'cc-given-name'
  | 'cc-additional-name'
  | 'cc-family-name'
  | 'cc-number'
  | 'cc-exp'
  | 'cc-exp-month'
  | 'cc-exp-year'
  | 'cc-csc'
  | 'cc-type'
  | 'transaction-currency'
  | 'transaction-amount'
  | 'language'
  | 'bday'
  | 'bday-day'
  | 'bday-month'
  | 'bday-year'
  | 'sex'
  | 'tel'
  | 'tel-country-code'
  | 'tel-national'
  | 'tel-area-code'
  | 'tel-local'
  | 'tel-local-prefix'
  | 'tel-local-suffix'
  | 'tel-extension'
  | 'impp'
  | 'url'
  | 'photo'
type Capture = 'user' | 'environment'
type CrossOrigin = 'anonymous' | 'use-credentials'
type Dir = 'ltr' | 'rtl' | 'auto'
type EncType = 'application/x-www-form-urlencoded' | 'multipart/form-data' | 'text/plain'
type EnterKeyHint = 'enter' | 'done' | 'go' | 'next' | 'previous' | 'search' | 'send'
type InputMode = 'none' | 'text' | 'decimal' | 'numeric' | 'tel' | 'search' | 'email' | 'url'
type KeyType = 'RSA' | 'DSA' | 'EC'
type TrackKind = 'subtitles' | 'captions' | 'descriptions' | 'chapters' | 'metadata'
type IFrameSandboxRestriction =
  | 'allow-downloads-without-user-activation'
  | 'allow-downloads'
  | 'allow-modals'
  | 'allow-orientation-lock'
  | 'allow-pointer-lock'
  | 'allow-popups'
  | 'allow-popups-to-escape-sandbox'
  | 'allow-presentation'
  | 'allow-same-origin'
  | 'allow-scripts'
  | 'allow-storage-access-by-user-activation'
  | 'allow-top-navigation'
  | 'allow-top-navigation-by-user-activation'
type Loading = 'eager' | 'lazy'
type ReferrerPolicy =
  | 'no-referrer'
  | 'no-referrer-when-downgrade'
  | 'origin'
  | 'origin-when-cross-origin'
  | 'same-origin'
  | 'strict-origin'
  | 'strict-origin-when-cross-origin'
  | 'unsafe-url'
type RelLink =
  | 'alternate'
  | 'author'
  | 'canonical'
  | 'dns-prefetch'
  | 'external'
  | 'help'
  | 'icon'
  | 'shortcut icon'
  | 'license'
  | 'manifest'
  | 'modulepreload'
  | 'next'
  | 'pingback'
  | 'preconnect'
  | 'prefetch'
  | 'preload'
  | 'prerender'
  | 'prev'
  | 'search'
  | 'stylesheet'
type RelAArea =
  | 'alternate'
  | 'author'
  | 'bookmark'
  | 'external'
  | 'help'
  | 'license'
  | 'next'
  | 'nofollow'
  | 'noopener'
  | 'noreferrer'
  | 'opener'
  | 'prev'
  | 'search'
  | 'tag'
type RelForm =
  | 'external'
  | 'help'
  | 'license'
  | 'next'
  | 'nofollow'
  | 'noopener'
  | 'noreferrer'
  | 'opener'
  | 'prev'
  | 'search'
type Target = '_self' | '_blank' | '_parent' | '_top'
type TypeButton = 'submit' | 'reset' | 'button'
type TypeCommand = 'command' | 'checkbox' | 'radio'
type TypeInput =
  | 'button'
  | 'checkbox'
  | 'color'
  | 'date'
  | 'datetime-local'
  | 'email'
  | 'file'
  | 'hidden'
  | 'image'
  | 'month'
  | 'number'
  | 'password'
  | 'radio'
  | 'range'
  | 'reset'
  | 'search'
  | 'submit'
  | 'tel'
  | 'text'
  | 'time'
  | 'url'
  | 'week'
type TypeMenu = 'menu'
type TypeMimeType = 'command' | 'checkbox' | 'radio'
type TypeScript = 'application/javascript' | 'application/ecmascript' | 'module' | string
type Preload = boolean | 'none' | 'metadata' | 'auto'

type ElementAttrs<T = Record<never, never>> = GlobalAttributes & ARIAAttributes & T

declare global {
  namespace JSX {
    // deno-lint-ignore no-empty-interface
    interface Element extends BasicElement {}
    type Children = string | readonly string[] | BasicElement | readonly BasicElement[] | readonly (string | BasicElement)[]

    interface IntrinsicElements {
      [element: string]: ElementAttrs
      //#region A
      a: ElementAttrs<{
        download?: string | boolean
        href?: string
        hreflang?: string
        media?: string | string[]
        ping?: string
        referrerpolicy?: ReferrerPolicy
        rel?: RelAArea
        target?: Target
        /**@deprecated*/
        charset?: string
        /**@deprecated*/
        coords?: string
        /**@deprecated*/
        name?: string
        /**@deprecated*/
        rev?: string
        /**@deprecated*/
        shape?: string
      }>
      abbr: ElementAttrs
      /**@deprecated*/
      acronym: ElementAttrs
      address: ElementAttrs
      /**@deprecated*/
      applet: ElementAttrs<{ align?: Alignment; alt?: string; code?: string; codebase?: string }>
      area: ElementAttrs<{
        alt?: string
        coords?: string
        download?: string | boolean
        href?: string
        hreflang?: string
        media?: string
        ping?: string
        referrerpolicy?: ReferrerPolicy
        rel?: RelAArea
        target?: Target
      }>
      article: ElementAttrs
      aside: ElementAttrs
      audio: ElementAttrs<{
        autoplay?: boolean
        controls?: boolean
        crossorigin?: CrossOrigin
        loop?: boolean
        muted?: boolean
        preload?: Preload
        src?: string
      }>
      //#endregion A
      //#region B
      b: ElementAttrs
      base: ElementAttrs<{ href?: string; target?: Target }>
      /**@deprecated*/
      basefont: ElementAttrs<{ /**@deprecated */ color?: string; font?: string; size?: number }>
      bdi: ElementAttrs
      bdo: ElementAttrs
      /**@deprecated*/
      bgsound: ElementAttrs<{ balance?: number; loop?: boolean; src?: string; volume?: number }>
      /**@deprecated*/
      big: ElementAttrs
      /**@deprecated*/
      blink: ElementAttrs
      blockquote: ElementAttrs<{ cite?: string }>
      body: ElementAttrs
      br: ElementAttrs
      button: ElementAttrs<{
        autofocus?: boolean
        disabled?: boolean
        form?: string
        formenctype?: EncType
        formmethod?: 'GET' | 'POST'
        formnovalidate?: boolean
        formtarget?: string
        name?: string
        type?: TypeButton
        value?: string
      }>
      //#endregion B
      //#region C
      canvas: ElementAttrs<{ height?: number; width?: number }>
      caption: ElementAttrs<{ align?: Alignment }>
      /**@deprecated*/
      center: ElementAttrs
      cite: ElementAttrs
      code: ElementAttrs
      col: ElementAttrs<{ /**@deprecated*/ align?: Alignment; span?: number }>
      colgroup: ElementAttrs<{ /**@deprecated*/ align?: Alignment; span?: number }>
      /**@deprecated*/
      content: ElementAttrs
      /**@deprecated*/
      command: ElementAttrs<{
        checked?: boolean
        disabled?: boolean
        icon?: string
        readiogroup?: string
        type?: TypeCommand
      }>
      //#endregion C
      //#region D
      data: ElementAttrs<{ value?: string }>
      datalist: ElementAttrs
      dd: ElementAttrs
      del: ElementAttrs<{ cite?: string; datetime?: string }>
      details: ElementAttrs<{ open?: boolean }>
      dfn: ElementAttrs
      dialog: ElementAttrs
      //#endregion D
      //#region E
      em: ElementAttrs
      embed: ElementAttrs<{ height?: number; src?: string; type?: TypeMimeType; width?: number }>
      //#endregion E
      //#region F
      fieldset: ElementAttrs<{ disabled?: boolean; form?: string; name?: string }>
      figcaption: ElementAttrs
      figure: ElementAttrs
      /**@deprecated*/
      font: ElementAttrs<{ /**@deprecated */ color?: string; font?: string; size?: number }>
      footer: ElementAttrs
      form: ElementAttrs<{
        accept?: string
        acceptCharset?: string
        action?: string
        autocomplete?: AutoComplete
        enctype?: EncType
        method?: 'GET' | 'POST'
        name?: string
        novalidate?: boolean
        rel?: RelForm
        target?: Target
      }>
      /**@deprecated*/
      frame: ElementAttrs
      /**@deprecated*/
      frameset: ElementAttrs
      //#endregion F
      //#region H
      h1: ElementAttrs
      h2: ElementAttrs
      h3: ElementAttrs
      h4: ElementAttrs
      h5: ElementAttrs
      h6: ElementAttrs
      head: ElementAttrs
      header: ElementAttrs
      /**@deprecated*/
      hgroup: ElementAttrs
      hr: ElementAttrs<{ /**@deprecated */ align?: Alignment; /**@deprecated */ color?: string }>
      html: ElementAttrs<{ manifest?: string }>
      //#endregion H
      //#region I
      i: ElementAttrs
      iframe: ElementAttrs<{
        align?: Alignment
        allow?: string
        csp?: string
        height?: number
        loading?: Loading
        referrerpolicy?: ReferrerPolicy
        sandbox?: string | IFrameSandboxRestriction[]
        src?: string
        srcdoc?: string
        width?: number
      }>
      img: ElementAttrs<{
        align?: Alignment
        alt?: string
        crossorigin?: CrossOrigin
        decoding?: string
        height?: number
        ismap?: boolean
        loading?: Loading
        referrerpolicy?: ReferrerPolicy
        sizes?: string
        src?: string
        srcset?: string
        usemap?: string
        width?: number
      }>
      input: ElementAttrs<{
        accept?: string
        alt?: string
        autocomplete?: AutoComplete
        autofocus?: boolean
        capture?: Capture
        checked?: boolean
        dirname?: string
        name?: string
        disabled?: boolean
        form?: string
        formenctype?: EncType
        formmethod?: 'GET' | 'POST'
        formnovalidate?: boolean
        formtarget?: string
        height?: number
        list?: string
        max?: number
        maxlength?: number
        minlength?: number
        min?: number
        multiple?: boolean
        pattern?: RegExp | string
        placeholder?: string
        readonly?: boolean
        required?: boolean
        size?: number
        src?: string
        step?: number
        type?: TypeInput
        usemap?: string
        value?: string
        width?: number
      }>
      ins: ElementAttrs<{ cite?: string; datetime?: string }>
      /**@deprecated*/
      isindex: ElementAttrs
      //#endregion I
      //#region K
      kbd: ElementAttrs
      /**@deprecated*/
      keygen: ElementAttrs<{
        autofocus?: boolean
        challenge?: string
        disabled?: boolean
        form?: string
        keytype?: KeyType
        name?: string
      }>
      //#endregion K
      //#region L
      label: ElementAttrs<{ for?: string; form?: string }>
      legend: ElementAttrs
      li: ElementAttrs<{ value?: string }>
      link: ElementAttrs<{
        crossorigin?: CrossOrigin
        href?: string
        hreflang?: string
        integrity?: string
        media?: string
        referrerpolicy?: ReferrerPolicy
        rel?: RelLink
        sizes?: string
        type?: string
      }>
      /**@deprecated*/
      listing: ElementAttrs
      //#endregion L
      //#region M
      main: ElementAttrs
      map: ElementAttrs<{ name?: string }>
      mark: ElementAttrs
      /**@deprecated*/
      marquee: ElementAttrs<{ loop?: boolean }>
      menu: ElementAttrs<{ type?: TypeMenu }>
      /**@deprecated*/
      menuitem: ElementAttrs
      meta: ElementAttrs<{ charset?: string; content?: string; httpEquiv?: string; name?: string }>
      meter: ElementAttrs<{ high?: number; low?: number; max?: number; min?: number; optimum?: number; value?: string }>
      //#endregion M
      //#region N
      nav: ElementAttrs
      /**@deprecated*/
      nobr: ElementAttrs
      /**@deprecated*/
      noframes: ElementAttrs
      noscript: ElementAttrs
      //#endregion N
      //#region O
      object: ElementAttrs<{
        data?: string
        form?: string
        height?: number
        name?: string
        type?: TypeMimeType
        usemap?: string
        width?: number
      }>
      ol: ElementAttrs<{ reversed?: boolean; start?: number }>
      optgroup: ElementAttrs<{ label?: string }>
      option: ElementAttrs<{ label?: string; selected?: boolean; value?: string }>
      output: ElementAttrs<{ for?: string; form?: string; name?: string }>
      //#endregion O
      //#region P
      p: ElementAttrs
      param: ElementAttrs<{ name?: string; value?: string }>
      picture: ElementAttrs
      /**@deprecated*/
      plaintext: ElementAttrs
      pre: ElementAttrs
      progress: ElementAttrs<{ form?: string; max?: number; value?: string }>
      //#endregion P
      //#region Q
      q: ElementAttrs<{ cite?: string }>
      //#endregion Q
      //#region R
      rp: ElementAttrs
      rt: ElementAttrs
      rtc: ElementAttrs
      ruby: ElementAttrs
      //#endregion R
      //#region S
      s: ElementAttrs
      samp: ElementAttrs
      script: ElementAttrs<{
        async?: boolean
        charset?: string
        crossorigin?: CrossOrigin
        defer?: boolean
        integrity?: string
        language?: string
        referrerpolicy?: ReferrerPolicy
        src?: string
        type?: TypeScript
      }>
      section: ElementAttrs
      select: ElementAttrs<{
        autocomplete?: AutoComplete
        autofocus?: boolean
        disabled?: boolean
        form?: string
        multiple?: boolean
        name?: string
        required?: boolean
        size?: number
      }>
      /**@deprecated*/
      shadow: ElementAttrs
      slot: ElementAttrs
      small: ElementAttrs
      source: ElementAttrs<{ media?: string; sizes?: string; src?: string; srcset?: string }>
      /**@deprecated*/
      spacer: ElementAttrs
      span: ElementAttrs
      /**@deprecated*/
      strike: ElementAttrs
      strong: ElementAttrs
      style: ElementAttrs<{ media?: string; scoped?: boolean; type?: TypeMimeType }>
      sub: ElementAttrs
      summary: ElementAttrs
      sup: ElementAttrs
      //#endregion S
      //#region T
      table: ElementAttrs<{ align?: Alignment; summary?: string }>
      tbody: ElementAttrs<{ align?: Alignment }>
      td: ElementAttrs<{ align?: Alignment; colspan?: number; headers?: string; rowspan?: number }>
      template: ElementAttrs
      textarea: ElementAttrs<{
        autocomplete?: AutoComplete
        autofocus?: boolean
        cols?: number
        dirname?: string
        disabled?: boolean
        form?: string
        enterkeyhint: EnterKeyHint
        inputMode?: InputMode
        maxlength?: number
        minlength?: number
        name?: string
        placeholder?: string
        readonly?: boolean
        required?: boolean
        rows?: number
      }>
      tfoot: ElementAttrs<{ align?: Alignment }>
      th: ElementAttrs<{ align?: Alignment; colspan?: number; headers?: string; rowspan?: number; scope?: string }>
      thead: ElementAttrs<{ align?: Alignment }>
      time: ElementAttrs<{ datetime?: string }>
      title: ElementAttrs
      tr: ElementAttrs<{ align?: Alignment }>
      track: ElementAttrs<{ default?: boolean; kind?: TrackKind; label?: string; src?: string; srclang?: string }>
      /**@deprecated */
      tt: ElementAttrs
      //#endregion T
      //#region U
      u: ElementAttrs
      ul: ElementAttrs
      //#endregion U
      //#region V
      var: ElementAttrs
      video: ElementAttrs<{
        autoplay?: boolean
        controls?: boolean
        crossorigin?: CrossOrigin
        height?: number
        loop?: boolean
        muted?: boolean
        poster?: string
        preload?: Preload
        src?: string
        width?: number
      }>
      //#endregion V
      //#region W
      wbr: ElementAttrs
      //#endregion W
      //#region X
      /**@deprecated */
      xmp: ElementAttrs
      //#endregion X
    }
  }
}
type BooleanLike = boolean | 'true' | 'false'

// deno-lint-ignore no-empty-interface
interface CSSRule {}

//#region ARIA

interface ARIAParent {
  ariaActiveDescendant?: string
}

interface ARIACollapsible {
  ariaExpanded?: BooleanLike
}

interface ARIABaseCell {
  ariaColSpan?: number
  ariaRowSpan?: number
  ariaColIndex?: number
  ariaRowIndex?: number
}

interface ARIABaseCellParent extends ARIAParent {
  ariaColCount?: number
  ariaRowCount?: number
}

interface ARIABaseItem {
  ariaPosInset?: number
  ariaSetSize?: number
}

interface ARIAOrientible {
  ariaOrientation?: 'vertical' | 'horizontal'
}

interface ARIACheckable {
  ariaChecked: BooleanLike | 'mixed'
}

interface ARIARange {
  ariaValueMax?: number
  ariaValueMin?: number
  ariaValueNow?: number
  ariaValueText?: string
}

interface ARIASelectable {
  ariaSelectable?: BooleanLike
}

interface ARIABaseAttributes {
  ariaAtomic?: BooleanLike
  ariaBusy?: BooleanLike
  ariaControls?: string | string[]
  ariaCurrent?: BooleanLike
  ariaDescribedBy?: string
  ariaDetails?: string
  ariaDisabled?: BooleanLike
  ariaDropEffect?: 'copy' | 'execute' | 'link' | 'move' | 'none' | 'popup'
  ariaErrorMessage?: string
  ariaFlowTo?: string
  ariaGrabbed?: BooleanLike
  ariaHasPopup?: BooleanLike
  ariaHidden?: BooleanLike
  ariaInvalid?: BooleanLike
  ariaKeyShortcuts?: string
  ariaLabel?: string
  ariaLabelledBy?: string
  ariaLive?: 'assertive' | 'off' | 'polite'
  ariaOwns?: string
  ariaRelevant?: 'additions' | 'additions text' | 'all' | 'removals' | 'text'
  ariaRoleDescription?: string
}

interface ARIANoneOnlyAttributes {
  role: 'banner' | 'none' | 'presentation' | 'rowgroup'
}

interface ARIACollapsibleOnlyAttributes extends ARIACollapsible {
  role:
    | 'alert'
    | 'article'
    | 'complementary'
    | 'contentinfo'
    | 'definition'
    | 'document'
    | 'feed'
    | 'figure'
    | 'form'
    | 'img'
    | 'link'
    | 'list'
    | 'log'
    | 'main'
    | 'marquee'
    | 'math'
    | 'navigation'
    | 'note'
    | 'region'
    | 'search'
    | 'status'
    | 'tabpanel'
    | 'term'
    | 'timer'
    | 'tooltip'
}

interface ARIAAlertDialogAttributes extends ARIACollapsible {
  role: 'alertdialog'
  ariaModal?: BooleanLike
}

interface ARIAApplicationAttributes extends ARIAParent, ARIACollapsible {
  role: 'application'
}

interface ARIAButtonAttributes extends ARIACollapsible {
  role: 'button'
  ariaPressed?: BooleanLike
}

interface ARIACheckboxAttributes extends ARIACheckable {
  role: 'checkbox'
  ariaReadonly?: BooleanLike
}

interface ARIACellAttributes extends ARIABaseCell {
  role: 'cell'
}

interface ARIAColumnHeaderAttributes extends ARIABaseCell, ARIACollapsible {
  role: 'columnheader'
  ariaSort?: 'ascending' | 'descending' | 'none' | 'other'
  ariaReadonly?: BooleanLike
  ariaRequired?: BooleanLike
  ariaSelected?: BooleanLike
}

interface ARIAComboBoxAttributes extends ARIAParent, ARIACollapsible, ARIASelectable, ARIAOrientible {
  role: 'combobox'
  ariaControls: string | string[]
  ariaAutoComplete?: 'inline' | 'list' | 'both' | 'none'
  ariaRequired?: BooleanLike
}

interface ARIADialogAttributes extends ARIACollapsible {
  role: 'dialog'
  ariaModal?: BooleanLike
}

interface ARIAGridAttributes extends ARIABaseCellParent, ARIACollapsible {
  role: 'grid'
  ariaLevel?: number
  ariaMultiSelectable?: BooleanLike
  ariaReadonly?: BooleanLike
}

interface ARIAGridCellAttributes extends ARIABaseCell, ARIACollapsible, ARIASelectable {
  role: 'gridcell'
  ariaReadonly?: BooleanLike
  ariaRequired?: BooleanLike
}

interface ARIAGroupAttributes extends ARIAParent, ARIACollapsible {
  role: 'group'
}

interface ARIAHeadingAttributes extends ARIACollapsible {
  role: 'heading'
  ariaLevel?: number
}

interface ARIAListBoxAttributes extends ARIAParent, ARIACollapsible, ARIAOrientible {
  role: 'listbox'
  ariaRequired?: BooleanLike
  ariaMultiSelectable?: BooleanLike
}

interface ARIAListItemAttributes extends ARIACollapsible, ARIABaseItem {
  role: 'listitem'
  ariaLevel?: number
}

interface ARIAMenuAttributes extends ARIAParent, ARIACollapsible, ARIAOrientible {
  role: 'menu'
}

interface ARIAMenuBarAttributes extends ARIAParent, ARIACollapsible, ARIAOrientible {
  role: 'menubar'
}

interface ARIAMenuItemAttributes extends ARIABaseItem {
  role: 'menuitem'
}

interface ARIAMenuItemCheckBoxAttributes extends ARIABaseItem, ARIACheckable {
  role: 'menuitemcheckbox'
}

interface ARIAMenuItemRadioAttributes extends ARIABaseItem, ARIACheckable {
  role: 'menuitemradio'
}

interface ARIAProgressBarAttributes extends ARIARange {
  role: 'progressbar'
}

interface ARIARadioAttributes extends ARIABaseItem, ARIASelectable, ARIACheckable {
  role: 'radio'
}

interface ARIARadioGroupAttributes extends ARIAParent, ARIAOrientible, ARIACollapsible {
  role: 'radiogroup'
  ariaRequired?: BooleanLike
}

interface ARIARowAttributes extends ARIAParent, ARIACollapsible, ARIASelectable, ARIABaseItem {
  role: 'row'
  ariaLevel?: number
  ariaColIndex?: number
  ariaRowIndex?: number
}

interface ARIARowHeaderAttributes extends ARIABaseCell, ARIACollapsible, ARIASelectable {
  role: 'rowheader'
  ariaReadonly?: BooleanLike
  ariaRequired?: BooleanLike
}

interface ARIAScrollBarAttributes
  extends Required<Omit<ARIARange, 'ariaValueText'>>,
    Required<ARIAOrientible>,
    ARIACollapsible {
  role: 'scrollbar'
  ariaControls: string | string[]
  ariaValueText?: string
}

interface ARIASearchBoxAttributes extends ARIAParent {
  role: 'searchbox'
  ariaAutoComplete?: 'inline' | 'list' | 'both' | 'none'
  ariaMultiSelectable?: BooleanLike
  ariaReadonly?: BooleanLike
  ariaPlaceholder?: string
}

interface ARIASeparatorAttributes extends ARIARange, ARIAOrientible {
  role: 'separator'
}

interface ARIASliderAttributes extends Required<Omit<ARIARange, 'ariaValueText'>>, ARIAOrientible {
  role: 'slider'
  ariaValueText?: string
}

interface ARIASpinButtonAttributes extends Required<Omit<ARIARange, 'ariaValueText'>> {
  role: 'spinbutton'
  ariaValueText?: string
  ariaReadonly?: BooleanLike
  ariaRequired?: BooleanLike
}

interface ARIASwitchAttributes extends ARIACheckable {
  role: 'switch'
  ariaRequired?: BooleanLike
}

interface ARIATabAttributes extends ARIASelectable, ARIABaseItem, ARIACollapsible {
  role: 'tab'
}

interface ARIATableAttributes extends Omit<ARIABaseCellParent, 'ariaActiveDescendant'> {
  role: 'table'
}

interface ARIATabListAttributes extends ARIAParent, ARIAOrientible {
  role: 'tablist'
  ariaLevel?: number
  ariaMultiSelectable?: BooleanLike
}

interface ARIATextBoxAttributes extends ARIAParent {
  role: 'textbox'
  ariaMultiLine?: BooleanLike
  ariaPlaceholder?: string
  ariaReadonly?: BooleanLike
  ariaRequired?: BooleanLike
}

interface ARIAToolbarAttributes extends ARIAParent, ARIACollapsible, ARIAOrientible {
  role: 'toolbar'
}

interface ARIATreeAttributes extends ARIAParent, ARIACollapsible, ARIAOrientible {
  role: 'tree'
  ariaMultiSelectable?: BooleanLike
  ariaRequired?: BooleanLike
}

interface ARIATreeGridAttributes extends ARIABaseCellParent, ARIACollapsible, ARIAOrientible {
  role: 'treegrid'
  ariaLevel?: number
  ariaMultiSelectable?: BooleanLike
  ariaReadonly?: BooleanLike
  ariaRequired?: BooleanLike
}

interface ARIATreeItemAttributes extends ARIABaseItem, ARIACollapsible, Partial<ARIACheckable>, ARIASelectable {
  role: 'treeitem'
  ariaLevel?: number
}

type ARIAAttributes =
  | ARIANoneOnlyAttributes
  | ARIACollapsibleOnlyAttributes
  | ARIABaseAttributes
  | ARIAAlertDialogAttributes
  | ARIAApplicationAttributes
  | ARIAButtonAttributes
  | ARIACheckboxAttributes
  | ARIACellAttributes
  | ARIAColumnHeaderAttributes
  | ARIAComboBoxAttributes
  | ARIADialogAttributes
  | ARIAGridAttributes
  | ARIAGridCellAttributes
  | ARIAGroupAttributes
  | ARIAHeadingAttributes
  | ARIAListBoxAttributes
  | ARIAListItemAttributes
  | ARIAMenuAttributes
  | ARIAMenuBarAttributes
  | ARIAMenuItemAttributes
  | ARIAMenuItemCheckBoxAttributes
  | ARIAMenuItemRadioAttributes
  | ARIAProgressBarAttributes
  | ARIARadioAttributes
  | ARIARadioGroupAttributes
  | ARIARowAttributes
  | ARIARowHeaderAttributes
  | ARIAScrollBarAttributes
  | ARIASearchBoxAttributes
  | ARIASeparatorAttributes
  | ARIASliderAttributes
  | ARIASpinButtonAttributes
  | ARIASwitchAttributes
  | ARIATabAttributes
  | ARIATableAttributes
  | ARIATabListAttributes
  | ARIATextBoxAttributes
  | ARIAToolbarAttributes
  | ARIATreeAttributes
  | ARIATreeGridAttributes
  | ARIATreeItemAttributes

//#endregion ARIA

interface GlobalBaseAttributes {
  accesskey?: string
  autocapitalize?: AutoCapitalize
  class?: string
  className?: string
  contenteditable?: BooleanLike
  dir?: Dir
  draggable?: BooleanLike
  /**@deprecated */
  dropzone?: 'copy' | 'move' | 'link'
  hidden?: boolean
  id?: string
  is?: string
  itemid?: string
  itemprop?: string
  itemref?: string
  itemscope?: boolean
  itemtype?: string
  lang?: string
  part?: string
  slot?: string
  spellcheck?: BooleanLike
  style?: string | CSSRule
  tabindex?: number
  title?: string
}

type GlobalAttributes =
  | GlobalBaseAttributes
  | (GlobalBaseAttributes & { contenteditable: true; enterkeyhint: EnterKeyHint; inputmode?: InputMode })

//#endregion Typings
