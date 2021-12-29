# Storybook Automation

_Automatically create stories for all your components and keep them up-to-date without any effort_

**Curently supports Vue and React projects**

## Setup

1. Install Storybook as usual, make sure knobs addon is installed as well.
2. Create _stories.js_ file to configure _storybook-automation_ package
3. Configure storybook as usual, point it to load previously created _stories.js_ file
4. Start storybook as usual
5. That's all, no matter what changes you do to your components, it will be automatically displayed in storybook

## Configuration

Moule exports only one method called `generateStories()`, it takes an options object as only parameter. Possible options are:

- storiesOf - Storybook's function to generate stories _(required | webpack's require context function)_
  - e.g.: `import { storiesOf } from "@storybook/vue"`
- filesContext - A context to all component files _(required | webpack's require context function)_
  - e.g.: `require.context('../components/', true, /\.vue$/)`
- plugins - Object with vue's plugins used in your project _(optional | Object)_
  - e.g.: `{ i18n: new VueI18n({})}`
- defineDefault - Function used to define default value for component's prop other than defined in your component _(optional | Function)_
  - e.g.: Component defines prop `items: { type: Array, default: [] }`, but we want to display it as `[{ title: 'Title 1' }, {title: 'Title 2' }]`
- defineEnum - Function used to define if commponent's prop should be displayed as dropdown _(optional | Function)_
  - e.g.: Component defines props `size: { type: String, default: 'MEDIUM' }`. The types is `string`, but in reality it is enumerable `type = { SMALL: 'SMALL', MEDIUM: 'MEDIUM', LARGE: 'LARGE' }`

### Params passed into `defineDefault()` and `defineEnum()`

There are many informations passed to these two methods to help you determine if
- some special default value shouuld be used
- prop value should be displayed as dropdown

Both functions receive optioons object as its only parameter. Passed informations are:

- componentName - name of component
- component - actual component object
- module - webpack module containing the component
- parent - compoonent's parent folder name
- propName - name of prop
- prop - prop definition (usually in format `{ type: String, default: '', required: false }`)


configure(loadStories, module)
```

### Basic Example

```javascript
// .storybook/stories.js

import { storiesOf } from "@storybook/vue"
import { generateStories } from 'storybook-automation'

generateStories({
  storiesOf,
  filesContext: require.context('../components/', true, /\.vue$/)
})
```

### With plugins

```javascript
// .storybook/stories.js

import { storiesOf } from "@storybook/vue"
import { generateStories } from 'storybook-automation'
import VueI18n from 'vue-i18n'

generateStories({
  storiesOf,
  filesContext: require.context('../components/', true, /\.vue$/),
  plugins: {
    i18n: new VueI18n({})
  }
})
```

### With prop where default value other than defined on component is desired

Story for _Component1.vue_ will be created with 2 knobs.
- `items` will use knob type _array_ with 2 items inside
- `actvieItem` will use knob type _number_ with 0 set

```javascript
// components/Component1/Component1.vue

export default class TheNavbar extends Vue {
  @Prop({ type: Array, default: () => [] }) readonly items!: Array<string>
  @Prop({ type: Number, default: 0 }) readonly activeItem!: number
}

// .storybook/stories.js

import { storiesOf } from "@storybook/vue"
import { generateStories } from 'storybook-automation'

generateStories({
  storiesOf,
  filesContext: require.context('../components/', true, /\.vue$/),
  defineDefault: ((options) => {
    if (options.propName === items) {
      return ['Navbar Item 1', 'Navbar Item 2']
    }
  }
})
```

### With prop which is enumerable and should be displayed as dropdown

Story for _Component1.vue_ will be created with 2 knobs.
- `type` will use knob type _select_ with 3 options and _SECONDARY_ selected
- `isEnabled` will use knob type _boolean_ and it will be checked

```javascript
// components/Component1/Component1.vue

export default class TheButton extends Vue {
  @Prop({ type: String, default: TheButton.constants.TYPE.SECONDARY }) readonly type!: string
  @Prop({ type: Boolean, default: true }) readonly isEnabled!: string

  public static constants: { TYPE } = {
    TYPE: {
      PRIMARY: 'PRIMARY',
      SECONDARY: 'SECONDARY',
      TERTIARY: 'TERTIARY'
    }
  }
}

// .storybook/stories.js

import { storiesOf } from "@storybook/vue"
import { generateStories } from 'storybook-automation'

generateStories({
  storiesOf,
  filesContext: require.context('../components/', true, /\.vue$/),
  defineEnum: ((options) => {
    const constName = options.propName.toUpperCase()

    return options.component.constants
    ? options.component.constants[constName]
    : undefined
  }
})
```

### With prop which is enumerable and should be displayed as dropdown

Story for _Component1.jsx_ will be created with 2 knobs.
- `type` will use knob type _select_ with 3 options and _SECONDARY_ selected
- `isEnabled` will use knob type _boolean_ and it will be checked

```javascript
// components/Component1/ComponentTypes.js

export const ButtonTypes = Object.freeze({
  PRIMARY: "PRIMARY",
  SECONDARY: "SECONDARY"
});

// components/Component1/Component1.jsx

import { ButtonTypes, ButtonSizes } from "./Component1Types";

export default class Button extends Component {}
Button.propTypes = {
  type: PropTypes.oneOf(Object.values(ButtonTypes)),
  disabled: PropTypes.bool,
  size: PropTypes.oneOf(Object.values(ButtonSizes)),
};

Button.defaultProps = {
  type: ButtonTypes.PRIMARY,
  disabled: false,
  size: ButtonSizes.MEDIUM
};

// .storybook/stories.js

import { storiesOf } from "@storybook/vue"
import { generateStories } from 'storybook-automation'

import { ButtonTypes, ButtonSizes } from "../src/Component1Types";
const ButtonEnums = {
  type: ButtonTypes,
  size: ButtonSizes
}

generateStories({
  storiesOf,
  filesContext: require.context('../components/', true, /\.jsx$/),
  defineEnum: (options) => {
    if (options.componentName === 'Component1')
    return ButtonEnums[options.propName]
  }
})
```
