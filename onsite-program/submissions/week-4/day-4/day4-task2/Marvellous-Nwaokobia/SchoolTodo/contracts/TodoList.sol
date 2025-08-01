// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

contract TodoList {
    struct Todo {
        uint256 id;
        string title;
        string description;
        bool status;
        bool exists;
    }

    mapping(address => Todo[]) public todos;
    mapping(address => uint256) private nextTodoId;

    event TodoAdded(address indexed user, uint256 id, string title, string description);
    event TodoUpdated(address indexed user, uint256 id, string title, string description, bool status);
    event TodoDeleted(address indexed user, uint256 id);

    function createTodo(string memory _title, string memory _description) public {
        require(bytes(_title).length > 0, "Title cannot be empty");

        uint256 id = nextTodoId[msg.sender]++;
        todos[msg.sender].push(Todo({
            id: id,
            title: _title,
            description: _description,
            status: false,
            exists: true
        }));

        emit TodoAdded(msg.sender, id, _title, _description);
    }

    function updateTodo(uint256 _id, string memory _title, string memory _description) public {
        require(_id < todos[msg.sender].length, "To-do does not exist");
        require(todos[msg.sender][_id].exists, "To-do does not exist");
        require(bytes(_title).length > 0, "Title cannot be empty");

        todos[msg.sender][_id].title = _title;
        todos[msg.sender][_id].description = _description;
        emit TodoUpdated(msg.sender, _id, _title, _description, todos[msg.sender][_id].status);
    }

    function toggleTodoStatus(uint256 _id) public {
        require(_id < todos[msg.sender].length, "To-do does not exist");
        require(todos[msg.sender][_id].exists, "To-do does not exist");

        todos[msg.sender][_id].status = !todos[msg.sender][_id].status;
        emit TodoUpdated(msg.sender, _id, todos[msg.sender][_id].title, todos[msg.sender][_id].description, todos[msg.sender][_id].status);
    }

    function deleteTodo(uint256 _id) public {
        require(_id < todos[msg.sender].length, "To-do does not exist");
        require(todos[msg.sender][_id].exists, "To-do does not exist");

        todos[msg.sender][_id].exists = false;
        emit TodoDeleted(msg.sender, _id);
    }

    function getTodos() public view returns (Todo[] memory) {
        uint256 count = 0;
        for (uint256 i = 0; i < todos[msg.sender].length; i++) {
            if (todos[msg.sender][i].exists) {
                count++;
            }
        }

        Todo[] memory activeTodos = new Todo[](count);
        uint256 index = 0;
        for (uint256 i = 0; i < todos[msg.sender].length; i++) {
            if (todos[msg.sender][i].exists) {
                activeTodos[index] = todos[msg.sender][i];
                index++;
            }
        }
        return activeTodos;
    }

    function getTodo(uint256 _id) public view returns (uint256, string memory, string memory, bool) {
        require(_id < todos[msg.sender].length, "To-do does not exist");
        require(todos[msg.sender][_id].exists, "To-do does not exist");
        Todo memory todo = todos[msg.sender][_id];
        return (todo.id, todo.title, todo.description, todo.status);
    }
}