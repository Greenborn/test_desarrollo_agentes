import { reactive } from 'vue'

const commands = reactive([])

export function useCommandRegistry() {
  function register(command) {
    const existing = commands.findIndex((c) => c.name === command.name)
    if (existing >= 0) {
      commands[existing] = command
    } else {
      commands.push(command)
    }
  }

  function find(name) {
    return commands.find((c) => c.name === name)
  }

  function categories() {
    const map = {}
    for (const cmd of commands) {
      const cat = cmd.category ? cmd.category : 'Sin categoría'
      if (!map[cat]) map[cat] = []
      map[cat].push(cmd)
    }
    return map
  }

  function suggest(input) {
    const trimmed = input.trim()
    if (!trimmed) return commands.map((c) => c.name)
    return commands
      .filter((c) => c.name.startsWith(trimmed))
      .map((c) => c.name)
  }

  return { commands, register, find, categories, suggest }
}
