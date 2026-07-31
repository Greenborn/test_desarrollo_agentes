# Diagnóstico: OllamaTab no muestra modelos

## Hipótesis
El TableEditor se renderiza pero sin filas, lo que indica que `modelos.value` tiene items pero los datos no llegan correctamente al TableEditor.

## Diagnóstico propuesto

Agregar logs en `frontend/src/modules/ollama/components/OllamaTab.vue`:

**1. En `cargarModelos` (línea 205), agregar:**
```js
console.log('[OllamaTab] Respuesta de /api/ollama/tags:', JSON.stringify(data))
console.log('[OllamaTab] modelos asignados:', modelos.value.length, 'modelos')
```

**2. En `tableData` (línea 155), agregar:**
```js
console.log('[OllamaTab] tableData computado, rows:', modelos.value.length)
```

**3. En `onMounted` (línea 383), agregar:**
```js
console.log('[OllamaTab] Componente montado')
```

## Instrucciones
1. Abrir `frontend/src/modules/ollama/components/OllamaTab.vue`
2. Agregar los logs indicados
3. Recargar la página en el navegador
4. Abrir la consola (F12) y hacer clic en la pestaña Ollama
5. Compartir la salida de los logs `[OllamaTab]`
