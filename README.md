# SelfEconomy 💰

## Mi Problema Personal
Quiero tener más control de mis finanzas. Para ello es importante saber en qué estamos gastando nuestro dinero. Los excels o PDFs de extractos bancarios contienen toda la información, pero hacer un análisis a simple vista con esos documentos no es sencillo y es poco intuitivo. Con esta app quiero resolver esto.

## La Solución
Mi idea es poder convertir archivos **XLSX, CSV o PDF** para normalizar los datos y juntarlo todo en una misma aplicación. 

A diferencia de otras apps en el mercado, donde tienes que ingresar manualmente cada gasto (lo que consume tiempo o lleva a que se te olvide), **SelfEconomy** busca automatizar este proceso.

## Mi Objetivo
Ahorrar tiempo y crear una aplicación que reciba y entienda cualquier archivo para normalizar los datos de manera centralizada. De esta forma, podemos ver qué estamos haciendo con nuestro dinero de una manera mucho más rápida y eficiente.

## Características Principales
- **Normalización de Datos**: Centraliza información de diferentes bancos y formatos.
- **Integración con IA**: Categorización automática de transacciones mediante inteligencia artificial para agilizar el proceso.
- **Visualización Intuitiva**: Análisis rápido de tus finanzas personales.

## ¿Cómo Funciona? 🤖

SelfEconomy usa **Inteligencia Artificial** para analizar tus extractos bancarios:

1. **Subida del Archivo**: Sube tu archivo (PDF, XLSX o CSV) desde cualquier banco.
2. **Análisis con IA**: La IA analiza la estructura del documento y genera un **template/plantilla** que describe cómo extraer las transacciones (formato de fecha, regex, separadores de miles/decimales).
3. **Procesamiento Automático**: El template se usa para extraer y normalizar todas las transacciones del archivo.
4. **Reutilización Inteligente**: El template se guarda automáticamente. La próxima vez que subas un extracto del mismo banco, **el sistema lo detecta automáticamente** y procesa el archivo sin necesidad de IA, ahorrando tiempo y tokens.

> 💡 Esto significa que solo necesitas usar IA una vez por tipo de extracto. Los siguientes archivos del mismo banco se procesan instantáneamente.

---

Espero que este proyecto pueda ayudar a cualquier persona interesada en mejorar sus finanzas personales. Si deseas contribuir, ¡eres bienvenido! Es una herramienta fácil de implementar que busca aportar un grano de arena al bienestar financiero de todos.

## Desarrollo Local

Primero, ejecuta el servidor de desarrollo:

```bash
npm run dev
# o
yarn dev
# o
pnpm dev
# o
bun dev
```

Abre [http://localhost:3000](http://localhost:3000) en tu navegador para ver el resultado.

