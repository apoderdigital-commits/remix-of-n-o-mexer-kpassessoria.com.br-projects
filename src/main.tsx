import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// ── Hardening contra a auto-tradução do navegador (Google Tradutor / extensões) ──
// Quando o tradutor substitui os nós de texto (envolvendo-os em <font>), o React pode
// acabar chamando removeChild/insertBefore num nó que já não está onde ele espera,
// causando: "Failed to execute 'removeChild' on 'Node': The node to be removed is not
// a child of this node." O index.html já pede notranslate (lang=pt-BR + meta), mas
// algumas extensões ignoram isso — então tornamos as duas operações tolerantes a esse
// desalinhamento, evitando o crash / a tela de erro.
if (typeof Node !== "undefined" && Node.prototype) {
  const _removeChild = Node.prototype.removeChild;
  Node.prototype.removeChild = function <T extends Node>(this: Node, child: T): T {
    if (child.parentNode !== this) {
      return child; // nó já foi movido/removido pela tradução — ignora sem quebrar
    }
    return _removeChild.call(this, child) as T;
  };

  const _insertBefore = Node.prototype.insertBefore;
  Node.prototype.insertBefore = function <T extends Node>(this: Node, newNode: T, referenceNode: Node | null): T {
    if (referenceNode && referenceNode.parentNode !== this) {
      return _insertBefore.call(this, newNode, null) as T; // referência inválida — anexa no fim
    }
    return _insertBefore.call(this, newNode, referenceNode) as T;
  };
}

createRoot(document.getElementById("root")!).render(<App />);
