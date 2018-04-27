FROM alpine:latest

# wkhtmltopdf
RUN apk update && apk upgrade && apk add --update --no-cache \
    libgcc libstdc++ libx11 glib libxrender libxext libintl \
    libcrypto1.0 libssl1.0 \
    ttf-dejavu ttf-droid ttf-freefont ttf-liberation ttf-ubuntu-font-family \
    nodejs imagemagick pdftk

COPY wkhtmltopdf /bin
RUN chmod +x /bin/wkhtmltopdf

ADD ./app.js ./
ADD ./package.json ./
RUN npm install
#ADD ./node_modules/ ./node_modules/

ENV NODE_ENV production
ENV WKHTMLTOPDF /bin/wkhtmltopdf
EXPOSE 8080
ENV FLASK_PROXY_PORT 8080
CMD ["node", "app.js"]