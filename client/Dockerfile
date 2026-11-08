FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .

# Recibir la URL de la API como argumento de build y exponerla para Vite
ENV VITE_API_URL=https://api-ipvu.itseprueba.com.ar/api
RUN echo "build $(date)"
RUN npm run build

# Detectar si el build quedó en dist o en build
RUN if [ -d "/app/dist" ]; then mv /app/dist /app/output; \
    elif [ -d "/app/build" ]; then mv /app/build /app/output; \
    else echo "No se encontró dist ni build" && exit 1; fi

FROM nginx:alpine
COPY --from=build /app/output /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
