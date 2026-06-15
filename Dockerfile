FROM php:7.4-apache

ENV APP_ENV=production \
    APP_DEBUG=false \
    APP_TIMEZONE=Asia/Bangkok \
    APP_LOG_FILE=/var/www/html/storage/app.log

RUN a2enmod headers rewrite \
    && printf '%s\n' \
        'expose_php=Off' \
        'display_errors=Off' \
        'log_errors=On' \
        'upload_max_filesize=250M' \
        'post_max_size=250M' \
        'max_execution_time=120' \
        'memory_limit=512M' \
        > /usr/local/etc/php/conf.d/app.ini

COPY docker/apache-vhost.conf /etc/apache2/sites-available/000-default.conf
COPY . /var/www/html

RUN mkdir -p /var/www/html/storage /var/www/html/public/downloads \
    && chown -R www-data:www-data /var/www/html/storage /var/www/html/public/downloads \
    && chmod 0750 /var/www/html/storage /var/www/html/public/downloads

EXPOSE 80

HEALTHCHECK --interval=15s --timeout=5s --start-period=10s --retries=5 \
    CMD php -r '$c=@file_get_contents("http://127.0.0.1/"); exit($c === false ? 1 : 0);'
