#!/bin/bash

dir=db_release
#echo $dir
filenames=`ls -1v db_release/*.sql`
echo $filenames | sort -n
echo "************************"

for eachfile in $filenames

do
file="${eachfile##*/}"
echo $file

newversion=$(echo $file | sed -e 's|db_release_||g; s|.sql||g')
echo "Version in Repository : $newversion"


# get current version from database
#currentversion=$(psql -qtAX -c 'SELECT version_number  FROM version WHERE created_at = (SELECT MAX(created_at) FROM version)')
echo $service_name
currentversion=$(psql -qtAX -c 'SELECT max(version_number) FROM version where service_name='$service_name'')

echo  "Current version in Database : $currentversion"
#echo $newversion
if [ 1 -eq "$(echo "$newversion>$currentversion" | bc)" ]; then

        echo "Backup in progress"
        chmod +x db-backup.sh
        ./db-backup.sh
        echo "db migration required"
        echo "New version to be integrated in Database : $newversion"
        
        psql -f $dir/$file
        
   updatedversion=$(psql -qtAX -c 'SELECT version_number  FROM version WHERE created_at = (SELECT MAX(created_at) FROM version)')     
    
   echo "Updated version in Database : $updatedversion"
   
   echo "***************************************************************************************************************"
   
else

        echo "db migration not required"
        
        
    echo "***************************************************************************************************************"



    fi

done
exit $returncode
