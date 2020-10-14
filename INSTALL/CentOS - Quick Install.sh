#!/bin/bash

echo "========================================================="
echo "==   Shinobi : The Open Source CCTV and NVR Solution   =="
echo "========================================================="
echo "This script will install Shinobi CCTV with minimal user"
echo "intervention."
echo
echo "You may skip any components you already have or do not"
echo "wish to install."
echo "========================================================="
read -p "Press [Enter] to begin..."

echo "Installing dependencies and tools"
#Check to see if we are running on a virtual machinie
if hostnamectl | grep -oq "Chassis: vm"; then
    vm="open-vm-tools"
else
    vm=""
fi
#Installing deltarpm first will greatly increase the download speed of the other packages
yum install deltarpm -y
#Install remaining packages
yum install nano $vm dos2unix net-tools curl wget git make zip -y

echo "Updating system"
sudo yum update -y
sudo yum install gcc gcc-c++ -y

#Skip if running from the Ninja installer
if [ "$1" != 1 ]; then
	#Clone git repo and change directory
	sudo git clone https://gitlab.com/Shinobi-Systems/Shinobi.git Shinobi
	cd Shinobi

	echo "========================================================="
	echo "Do you want to use the Master or Development branch of Shinobi?"
	read -p "[M]aster or [D]ev " gitbranch

	#Changes input to uppercase
	gitbranch=${gitbranch^}

	if [ "$gitbranch" = "D" ]; then
		#Change to dev branch
		sudo git checkout dev
		sudo git pull
	fi
fi

if ! [ -x "$(command -v node)" ]; then
    echo "========================================================="
    echo "Node.js not found, installing..."
    sudo curl --silent --location https://rpm.nodesource.com/setup_12.x | bash -
    sudo yum install nodejs -y
else
    echo "Node.js is already installed..."
    echo "Version : $(node -v)"
fi
if ! [ -x "$(command -v npm)" ]; then
    sudo yum install npm -y
fi

echo "========================================================="
read -p "Do you want to install FFMPEG? Y/N " ffmpeginstall

#Changes input to uppercase
ffmpeginstall=${ffmpeginstall^}

if [ "$ffmpeginstall" = "Y" ]; then
    #Install EPEL Repo
    sudo yum install epel-release -y
    #Enable Nux Dextop repo for FFMPEG
    sudo rpm --import http://li.nux.ro/download/nux/RPM-GPG-KEY-nux.ro
    sudo rpm -Uvh http://li.nux.ro/download/nux/dextop/el7/x86_64/nux-dextop-release-0-1.el7.nux.noarch.rpm
    sudo yum install ffmpeg ffmpeg-devel -y
fi

echo "========================================================="
echo "Do you want to install MariaDB?"
echo
echo "Press [ENTER] for default [MariaDB]"
read -p "[M]ariaDB, or [N]othing " installdbserver

#Changes input to uppercase
sqliteormariadb=${installdbserver^}

if [ "installdbserver" = "M" ] || [ "$installdbserver" = "" ]; then
    echo "========================================================="
    echo "Installing MariaDB repository..."
	#Add the MariaDB repository to yum
	sudo curl -sS https://downloads.mariadb.com/MariaDB/mariadb_repo_setup | sudo bash -s -- --skip-maxscale
	echo "Installing MariaDB..."
    sudo yum install mariadb mariadb-server -y
    #Start mysql and enable on boot
    sudo systemctl start mariadb
    sudo systemctl enable mariadb
    #Run mysql install
    sudo mysql_secure_installation

	echo "========================================================="
    read -p "Install default database? Y/N " mysqlDefaultData

	#Changes input to uppercase
	mysqlDefaultData=${mysqlDefaultData^}

    if [ "$mysqlDefaultData" = "Y" ]; then
        echo "Please enter your MariaDB Username"
        read sqluser
        until [ "$mariadbPasswordConfirmation" = "Y" ]; do
			echo "Please enter your MariaDB Password"
            read -s sqlpass

			echo "Please confirm your MariaDB Password"
			read -s sqlpassconfirm

			if [ "$sqlpass" == "$sqlpassconfirm" ]; then
				mariadbPasswordConfirmation = "Y"
			else
				echo "Passwords did not match."
				echo "Please try again."
			fi
		done

        sudo mysql -u $sqluser -p$sqlpass -e "source sql/user.sql" || true
        sudo mysql -u $sqluser -p$sqlpass -e "source sql/framework.sql" || true
    fi

elif [ "$installdbserver" = "N" ]; then
    echo "========================================================="
    echo "Skipping database server installation..."
fi

echo "========================================================="
echo "Installing NPM libraries..."
sudo npm i npm -g
sudo npm install --unsafe-perm
sudo npm install ffbinaries mp4frag@latest cws@latest
sudo npm audit fix --force

echo "========================================================="
echo "Installing PM2..."
sudo npm install pm2@latest -g

sudo chmod -R 755 .
touch INSTALL/installed.txt
dos2unix INSTALL/shinobi
ln -s INSTALL/shinobi /usr/bin/shinobi

echo "========================================================="
read -p "Automatically create firewall rules? Y/N " createfirewallrules

#Changes input to uppercase
createfirewallrules=${createfirewallrules^}

if [ "$createfirewallrules" = "Y" ]; then
    sudo firewall-cmd --permanent --add-port=8080/tcp -q
    sudo firewall-cmd --reload -q
fi

#Create default configuration file
if [ ! -e "./conf.json" ]; then
    cp conf.sample.json conf.json

    #Generate a random Cron key for the config file
    cronKey=$(head -c 1024 < /dev/urandom | sha256sum | awk '{print substr($1,1,29)}')
	#Insert key into conf.json
    sed -i -e 's/change_this_to_something_very_random__just_anything_other_than_this/'"$cronKey"'/g' conf.json
fi

if [ ! -e "./super.json" ]; then
    echo "========================================================="
    echo "Enable superuser access?"
    echo "This may be useful for account and password managment"
    read -p "in commercial deployments. Y/N " createSuperJson

	#Changes input to uppercase
	createSuperJson=${createSuperJson^}

    if [ "$createSuperJson" = "Y" ]; then
        sudo cp super.sample.json super.json
    fi
fi

echo "========================================================="
read -p "Start Shinobi on boot? Y/N " startupShinobi

	#Changes input to uppercase
	startupShinobi=${startupShinobi^}

if [ "$startupShinobi" = "Y" ]; then
    sudo pm2 startup
    sudo pm2 save
    sudo pm2 list
fi

echo "========================================================="
read -p "Start Shinobi now? Y/N " startShinobi

	#Changes input to uppercase
	startShinobi=${startShinobi^}

if [ "$startShinobi" = "Y" ]; then
    sudo pm2 start camera.js
    sudo pm2 start cron.js
fi

echo ""
echo "========================================================="
echo "||=============== Installation Complete ===============||"
echo "========================================================="
echo "|| Login with the Superuser and create a new user!!    ||"
echo "========================================================="
echo "|| Open http://$(ifconfig | sed -En 's/127.0.0.1//;s/.*inet (addr:)?(([0-9]*\.){3}[0-9]*).*/\2/p'):8080/super in your browser. ||"
echo "========================================================="
if [ "$createSuperJson" = "Y" ]; then
    echo "|| Default Superuser : admin@shinobi.video             ||"
    echo "|| Default Password : admin                            ||"
	echo "|| You can edit these settings in \"super.json\"       ||"
	echo "|| located in the Shinobi directory.                   ||"
    echo "========================================================="
fi
