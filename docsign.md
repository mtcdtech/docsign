Want to create a new web app that allows church members to sign PDFs that are uploaded by admins

Requirements
- app will be self-hosted in a Synology docker container running container manager and portainer
- app will be accessed via web (reverse proxy with SSL cert) to docsign.server.mtcd.org, and the docker container can be at port 3656 (i will create an nginx proxy to forward to this port)
- app will have an admin portal where organization leaders can upload word documents or PDFs, desgin and place fields for collecting information, and add locations for signature.  The questionnaires should allow for simple logic (e.g. ask quesiton based on DOB, if age < 18 have parental signature).  I am open to suggestions on how to design this so its easy to build but also user friendly
- documents are sorted by organization, and each organzation leader will only see/edit their own org documents
- portal allows the finalized form to be downloaded as a PDF, emailed to the user and organization leader, stored locally within the webapp for retrieval and/or uploaded to a SharePoint folder.  the portal should give the leader options for all these, including which sharepoint folder to save to
- documents can be shaerd as a public link with a slug that any user can access
- admins will have global access to edit all settings
- admins and org leaders will login via our local Authentik instance, either via MS or PCO.   our IAM portal will determine who the admins are (read IAM-API.md for details)
- users can fill out the form and be able to add their signature (either by drawing the mouse or using their finger on mobile).  The form can be emailed to the user (and guardian if applicable)
- the app should be theme-able and every page should be mobile-first