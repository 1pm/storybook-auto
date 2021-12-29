var path = require("path");
var withKnobs = require("@storybook/addon-knobs").withKnobs;
var knobFns = require("@storybook/addon-knobs");
var React = require("react");

var COMPONENT_TYPE = {
  VUE: "VUE",
  REACT: "REACT"
};

function getFileInfo(file) {
  return {
    name: path.basename(file).split(".").shift(),
    parent: path.dirname(file).split("/").pop().replace(/^\.+/,""),
    file: file
  };
}

function findComponent(module, fileInfo) {
  if (!module) {
    console.error("No module found in " + fileInfo.file);
  } else if (module.default) {
    return module.default;
  } else if (module[fileInfo.name]) {
    return module[fileInfo.name];
  } else if (Object.keys(module).length > 0) {
    return module[Object.keys(module)[0]];
  } else {
    console.error("Cannot properly detect component in " +fileInfo.file);
  }
}

function findInComponent(component, name) {
  if (component.options && component.options[name]) {
    return component.options[name];
  } else if (component.$options && component.$options[name]) {
    return component.$options[name];
  } else if (component[name]) {
    return component[name];
  }
}

function getComponentMixinProps(component) {
  var mixins = findInComponent(component, "mixins") || [];
  var props = {};

  mixins.forEach(function(mixin) {
    if (mixin.props) {
      Object.assign(props, mixin.props);
    }
  });

  return props;
}

function getComponentProps(component) {
  var mixinProps = getComponentMixinProps(component);
  var props = findInComponent(component, "props") || {};

  if (component.propTypes) {
    Object.keys(component.propTypes).forEach(function(propName) {
      props[propName] = { type: component.propTypes[propName], default: component.defaultProps[propName] };
    });
  }

  return Object.assign({}, mixinProps, props);
}

function getPropType(prop) {
  var type;

  if (typeof prop.type === "string") {
    type = prop.type;
  } else if (prop.type === File) {
    type = "file";
  } else if (typeof prop.type === "function") {
    try {
      type = typeof prop.type();
    } catch (e) {}
  }

  if (type === undefined) {
    if (prop.default !== undefined) {
      type = typeof prop.default;
    } else {
      type = "string";
    }
  }

  return type === "string" ? "text" : type;
}

function getKnobArgs(propObj) {
  var defaultValue = propObj.propDefaultRes;

  if (defaultValue === undefined) {
    defaultValue = typeof propObj.prop.default === "function" ? propObj.prop.default() : propObj.prop.default;
  }
  if (defaultValue === undefined) {
    defaultValue = {
      boolean: false,
      number: 0,
      object: {},
      array: [],
      text: propObj.propName,
      select: propObj.propName
    }[propObj.propType];
  }

  var stringDefaultValue = JSON.stringify(defaultValue);

  if (["[]", "{}"].includes(stringDefaultValue)) {
    defaultValue = new Proxy(defaultValue, {
      get: function(obj, prop) {
            if (prop in obj) {
              return obj[prop];
            }
            var fn = function() {};
            fn.toString = function() {
              return "Proxy property \"" + prop + "\" of prop \"" + propObj.propName + "\" by storybook automation";
            };
            return fn;
        }
    });
  }

  if (propObj.propEnumRes && !propObj.propEnumRes[defaultValue]) {
    propObj.propEnumRes[defaultValue] = defaultValue;
  }

  return propObj.propEnumRes ? [propObj.propName, propObj.propEnumRes, defaultValue] : [propObj.propName, defaultValue];
}

function getProp(propObj) {
  var value;
  if (propObj.propType === "file") {
    value = new File([], "");
  } else if (propObj.propType === "function") {
    value = function() {
      try {
        alert(propObj.propName);
      } catch (e) {}
    };
  } else {
    var knobFn = knobFns[propObj.propType] || knobFns["text"];
    var knobArgs = getKnobArgs(propObj);
    value = knobFn.apply(undefined, knobArgs);
  }

  return propObj.componentObj.type === COMPONENT_TYPE.REACT ? value : { default: value };
}

function getProps(componentObj, defineDefault, defineEnum) {
  var props = {};
  var componentProps = getComponentProps(componentObj.component);

  if (componentObj.type === COMPONENT_TYPE.VUE) {
    componentProps.SLOT = { type: String };
  }

  Object.keys(componentProps).forEach(function(propName) {
    var prop = componentProps[propName];
    var options = Object.assign({}, componentObj, {
      propName: propName,
      prop: prop
    });
    var propDefaultRes = defineDefault(options);
    var propEnumRes = defineEnum(options);

    props[propName] = getProp(Object.assign({}, {
      componentObj: componentObj,
      propName: propName,
      prop: prop,
      propDefaultRes: propDefaultRes,
      propEnumRes: propEnumRes,
      propType: propEnumRes ? "select" : getPropType(prop)
    }));
  });

  return props;
}

function getTemplate(componentObj) {
  var componentProps = getComponentProps(componentObj.component);
  var template = "<" + componentObj.componentName + "\n";

  if (componentProps) {
    var props = Object.keys(componentProps).map(function(propName) {
      return "  :" + propName + "=\"" + propName + "\"";
    });
    template += props.join("\n");
  }
  template += "\n>{{ SLOT }}</" + componentObj.componentName + ">";

  return template;
}

function generateStoryVue(componentObj, plugins, defineDefault, defineEnum) {
  componentObj.storiesOf(componentObj.parent || componentObj.componentName, module)
  .addDecorator(withKnobs)
  .add(componentObj.componentName, function() {
    var components = {};
    components[componentObj.componentName] = componentObj.component;
    return Object.assign({}, plugins, {
      components: components,
      template: getTemplate(componentObj),
      props: getProps(componentObj, defineDefault, defineEnum),
      store: new Proxy({}, {
        get: function(o, p) {
              if (p in o) {
                return o[p];
              }
              var fn = function() {};
              fn.toString = function() {
                return "Proxy property \"" + p + "\" from store by storybook automation";
              };
              return fn;
          }
      })
    });
  });
}

function generateStoryReact(componentObj, plugins, defineDefault, defineEnum) {
  componentObj.storiesOf(componentObj.parent || componentObj.componentName, module)
  .addDecorator(withKnobs)
  .add(componentObj.componentName, function() {
    return React.createElement(componentObj.component, getProps(componentObj, defineDefault, defineEnum));
  });
}

exports.generateStories = function(options) {
  if (typeof options.plugins !== "object") {
    options.plugins = {};
  }
  if (typeof options.defineDefault !== "function") {
    options.defineDefault = function() {};
  }
  if (typeof options.defineEnum !== "function") {
    options.defineEnum = function() {};
  }

  if (typeof options.filesContext === "function" && typeof options.filesContext.keys === "function") {
    options.filesContext.keys().forEach(function(file) {
      var fileInfo = getFileInfo(file);
      var module = options.filesContext(file);
      var component = findComponent(module, fileInfo);
      var type = component.prototype && component.prototype.isReactComponent ? COMPONENT_TYPE.REACT : COMPONENT_TYPE.VUE;
      var generateStory = type === COMPONENT_TYPE.REACT ? generateStoryReact : generateStoryVue;

      if (component) {
        generateStory({
          storiesOf: options.storiesOf,
          type: type,
          parent: fileInfo.parent,
          componentName: fileInfo.name,
          component: component,
          module: module
        }, options.plugins, options.defineDefault, options.defineEnum);
      }
    });
  }
};