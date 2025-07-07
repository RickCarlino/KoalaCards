module.exports = {
  meta: {
    type: "problem",
    docs: {
      description: "Disallow else if statements",
      category: "Stylistic Issues",
      recommended: false,
    },
    messages: {
      noElseIf: "else if statements are not allowed. Use switch statements, lookup tables, or early returns instead.",
    },
    schema: [],
  },
  create(context) {
    return {
      IfStatement(node) {
        if (node.alternate && node.alternate.type === "IfStatement") {
          context.report({
            node: node.alternate,
            messageId: "noElseIf",
          });
        }
      },
    };
  },
};