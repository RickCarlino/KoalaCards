module.exports = {
  rules: {
    "no-else-if": {
      meta: {
        type: "problem",
        docs: {
          description: "Disallow else if statements",
          category: "Stylistic Issues",
          recommended: false,
        },
        fixable: null,
        schema: [],
        messages: {
          noElseIf:
            "'else if' statements are not allowed. Use switch statements, lookup tables or polymorphism.",
        },
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
    },
  },
};