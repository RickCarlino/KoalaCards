import * as babel from "prettier/plugins/babel";
import * as estree from "prettier/plugins/estree";
import * as flow from "prettier/plugins/flow";
import * as meriyah from "prettier/plugins/meriyah";
import * as typescript from "prettier/plugins/typescript";

const stripComments = (node) => {
  if (!node || typeof node !== "object") {
    return node;
  }

  if (Array.isArray(node)) {
    node.forEach(stripComments);
    return node;
  }

  delete node.comments;
  delete node.leadingComments;
  delete node.trailingComments;
  delete node.innerComments;

  Object.values(node).forEach(stripComments);
  return node;
};

const withoutComments = (parser, astFormat = "estree") => ({
  ...parser,
  astFormat: `${astFormat}-commentless`,
  parse(text, parsers, options) {
    const ast = parser.parse(text, parsers, options);
    return stripComments(ast);
  },
});

const commentlessPrinter = {
  ...estree.printers.estree,
  printComment() {
    return "";
  },
  canAttachComment() {
    return false;
  },
  handleComments: {
    ...estree.printers.estree.handleComments,
    ownLine() {
      return false;
    },
    endOfLine() {
      return false;
    },
    remaining() {
      return false;
    },
  },
};

export const printers = {
  "estree-commentless": commentlessPrinter,
};

export const parsers = {
  babel: withoutComments(babel.parsers.babel),
  "babel-ts": withoutComments(babel.parsers["babel-ts"]),
  flow: withoutComments(flow.parsers.flow),
  meriyah: withoutComments(meriyah.parsers.meriyah),
  typescript: withoutComments(typescript.parsers.typescript),
};
