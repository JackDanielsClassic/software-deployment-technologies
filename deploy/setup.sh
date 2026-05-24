#!/bin/bash

set -e

echo "======================================"
echo "Починаємо розгортання веб-застосунку..."
echo "======================================"

if [ "$EUID" -ne 0 ]; then
  echo "Помилка: Цей скрипт потрібно запускати з правами sudo (root)!"
  exit 1
fi

echo "[1/6] Оновлення репозиторіїв та встановлення базових пакетів..."

apt-get update -y
apt-get install -y curl git
apt-get install -y mariadb-server nginx

curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt-get install -y nodejs

echo "[1/6] Усі пакети успішно встановлено!"

echo "[2/6] Створення користувачів та налаштування прав доступу..."

create_user() {
    local username=$1
    local password=$2
    local force_change=$3 # true або false

    if ! id "$username" &>/dev/null; then
        useradd -m -s /bin/bash "$username"
        echo "$username:$password" | chpasswd

        if [ "$force_change" = true ]; then
            chage -d 0 "$username"
        fi
        echo "Користувача $username створено."
    else
        echo "Користувач $username вже існує, пропускаємо..."
    fi
}

create_user "student" "student123" false
usermod -aG sudo student

create_user "teacher" "12345678" true
usermod -aG sudo teacher

if ! id "app" &>/dev/null; then
    useradd -r -s /bin/false app
    echo "Системного користувача app створено."
fi

create_user "operator" "12345678" true

echo "Налаштування специфічних прав sudo для operator..."

cat > /etc/sudoers.d/operator <<EOF
operator ALL=(ALL) /bin/systemctl start mywebapp, /bin/systemctl stop mywebapp, /bin/systemctl restart mywebapp, /bin/systemctl status mywebapp, /bin/systemctl reload nginx
EOF
chmod 0440 /etc/sudoers.d/operator

echo "[2/6] Користувачів успішно налаштовано!"

echo "[3/6] Налаштування бази даних MariaDB..."

systemctl start mariadb
systemctl enable mariadb

mysql -e "CREATE DATABASE IF NOT EXISTS notes_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
mysql -e "CREATE USER IF NOT EXISTS 'app_user'@'localhost' IDENTIFIED BY 'AppSecretPass123';"
mysql -e "GRANT ALL PRIVILEGES ON notes_db.* TO 'app_user'@'localhost';"
mysql -e "FLUSH PRIVILEGES;"

echo "Базу даних та користувача app_user створено."

if [ -f "db/init.sql" ]; then
    mysql notes_db < db/init.sql
    echo "Міграцію бази даних (init.sql) успішно виконано."
else
    echo "Попередження: Файл db/init.sql не знайдено! Переконайся, що запускаєш скрипт із кореня проєкту."
fi

echo "[3/6] Базу даних успішно налаштовано!"

echo "[4/6] Розгортання застосунку та налаштування systemd..."

mkdir -p /opt/mywebapp

cp app/server.js /opt/mywebapp/
cp app/package.json /opt/mywebapp/
cp db/init.sql /opt/mywebapp/
cd /opt/mywebapp
npm install

chown -R app:app /opt/mywebapp

cd - > /dev/null

if [ -f "deploy/mywebapp.service" ] && [ -f "deploy/mywebapp.socket" ]; then
    cp deploy/mywebapp.service /etc/systemd/system/
    cp deploy/mywebapp.socket /etc/systemd/system/

    systemctl daemon-reload
    systemctl disable mywebapp.service 2>/dev/null || true
    systemctl stop mywebapp.service 2>/dev/null || true
    systemctl enable mywebapp.socket
    systemctl start mywebapp.socket

    echo "Сервіс mywebapp успішно налаштовано (через Socket Activation)."
else
    echo "Помилка: Файли deploy/mywebapp.service або deploy/mywebapp.socket не знайдено!"
fi

echo "[4/6] Етап розгортання застосунку завершено!"

echo "[5/6] Налаштування Nginx як Reverse Proxy..."

if [ -f "deploy/nginx.conf" ]; then
    cp deploy/nginx.conf /etc/nginx/sites-available/mywebapp

    ln -sf /etc/nginx/sites-available/mywebapp /etc/nginx/sites-enabled/

    rm -f /etc/nginx/sites-enabled/default

    systemctl restart nginx
    echo "Nginx успішно налаштовано."
else
    echo "Помилка: Файл deploy/nginx.conf не знайдено!"
fi

echo "[6/6] Фінальні налаштування системи..."

echo "12" > /home/student/gradebook
chown student:student /home/student/gradebook
chmod 644 /home/student/gradebook
echo "Файл /home/student/gradebook створено."

if id "ubuntu" &>/dev/null; then
    usermod -L ubuntu
    echo "Дефолтного користувача 'ubuntu' заблоковано."
else
    echo "Користувача 'ubuntu' не знайдено, перевірте дефолтного користувача вашої ВМ."
fi

echo "======================================"
echo "Розгортання успішно завершено!"
echo "======================================"
