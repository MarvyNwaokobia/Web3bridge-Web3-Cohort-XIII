import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

const TodoListModule = buildModule("TodoListModule", (m) => {
  const todo = m.contract("TodoList");

  return { todo };
});

export default TodoListModule;
